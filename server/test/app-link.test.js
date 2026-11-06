import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDailyLink, shareableLmp } from '../../src/lib/telegramLink.js'

test('кнопка не кладёт дату в ссылку', async () => {
  const lmp = shareableLmp('lmp', '2026-08-10', new Date('2026-11-06T12:00:00'))
  assert.equal(lmp, '2026-08-10')
  assert.equal(shareableLmp('lmp', '', new Date('2026-11-06T12:00:00')), null)
  assert.equal(shareableLmp('lmp', '2026-11-07', new Date('2026-11-06T12:00:00')), null)

  const result = await buildDailyLink({
    username: '@bulochka_bot',
    apiBase: 'http://127.0.0.1:8787',
    lmp,
    clientId: 'browser-client-0001',
    fetchImpl: async (_url, options) => {
      const body = JSON.parse(options.body)
      assert.equal(body.lmp, '2026-08-10')
      return {
        ok: true,
        json: async () => ({ url: 'https://t.me/bulochka_bot?start=one-time-token', hasDate: true }),
      }
    },
  })
  assert.equal(result.via, 'token')
  assert.equal(result.hasDate, true)
  assert.equal(result.url.includes('2026-08-10'), false)

  const direct = await buildDailyLink({ username: 'bulochka_bot', apiBase: '', lmp, clientId: 'x' })
  assert.equal(direct.url, 'https://t.me/bulochka_bot')
  assert.equal(direct.hasDate, false)

  const missing = await buildDailyLink({ username: '', apiBase: '', lmp, clientId: 'x' })
  assert.equal(missing.error, 'unconfigured')
})

test('дата родов в приложении пересчитывается в первый день месячных', () => {
  const due = '2027-05-17'
  const lmp = shareableLmp('edd', due, new Date('2026-11-06T12:00:00'))
  assert.equal(lmp, '2026-08-10')
})
