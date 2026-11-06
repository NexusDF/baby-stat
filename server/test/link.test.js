import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import test from 'node:test'
import { hashToken, seal, unseal } from '../src/crypto.js'
import { consumeToken, openDatabase } from '../src/db.js'
import { startHttp } from '../src/http.js'
import { addIsoDays } from '../src/term.js'

const TODAY = '2026-11-06'

async function withServer(run) {
  const key = randomBytes(32)
  const db = openDatabase(':memory:')
  const server = await startHttp({
    db,
    key,
    port: 0,
    host: '127.0.0.1',
    origins: ['http://127.0.0.1:5173'],
    botUsername: 'bulochka_bot',
    tokenTtlMs: 1000,
  })
  const port = server.address().port
  try {
    await run({ db, key, port })
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

test('ссылка одноразовая, дата не попадает ни в URL, ни в базу открытым текстом', async () => {
  await withServer(async ({ db, key, port }) => {
    const lmp = '2026-08-10'
    const response = await fetch(`http://127.0.0.1:${port}/v1/telegram/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://127.0.0.1:5173' },
      body: JSON.stringify({ lmp, clientId: 'browser-client-0001' }),
    })
    assert.equal(response.status, 200)
    const payload = await response.json()
    assert.equal(payload.hasDate, true)
    assert.equal(payload.url.includes(lmp), false)
    assert.match(payload.url, /^https:\/\/t\.me\/bulochka_bot\?start=[A-Za-z0-9_-]+$/)

    const token = new URL(payload.url).searchParams.get('start')
    const stored = db.prepare('SELECT token_hash, lmp_enc FROM link_tokens').get()
    assert.equal(stored.token_hash, hashToken(token))
    assert.equal(stored.token_hash.includes(token), false)
    assert.equal(String(stored.lmp_enc).includes(lmp), false)
    assert.equal(unseal(key, stored.lmp_enc), lmp)

    const now = new Date().toISOString()
    assert.equal(unseal(key, consumeToken(db, hashToken(token), now).lmpEnc), lmp)
    assert.equal(consumeToken(db, hashToken(token), now), null)
    assert.equal(db.prepare('SELECT lmp_enc FROM link_tokens').get().lmp_enc, null)
  })
})

test('пустая дата даёт ссылку без срока, плохая дата не сохраняется', async () => {
  await withServer(async ({ db, port }) => {
    const empty = await fetch(`http://127.0.0.1:${port}/v1/telegram/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lmp: null }),
    })
    const emptyBody = await empty.json()
    assert.equal(emptyBody.hasDate, false)
    assert.match(emptyBody.url, /\?start=/)

    const future = await fetch(`http://127.0.0.1:${port}/v1/telegram/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lmp: '2026-12-01' }),
    })
    assert.equal(future.status, 422)
    const old = await fetch(`http://127.0.0.1:${port}/v1/telegram/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lmp: addIsoDays(TODAY, -295) }),
    })
    assert.equal(old.status, 422)
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM link_tokens').get().n, 1)
  })
})

test('протухший токен нельзя использовать', async () => {
  const key = randomBytes(32)
  const db = openDatabase(':memory:')
  const token = 'abcdefghij123456'
  db.prepare(`
    INSERT INTO link_tokens (token_hash, lmp_enc, client_id, expires_at, used_at)
    VALUES (?, ?, NULL, ?, NULL)
  `).run(hashToken(token), seal(key, '2026-08-10'), '2020-01-01T00:00:00.000Z')
  assert.equal(consumeToken(db, hashToken(token), '2026-11-06T00:00:00.000Z'), null)
})
