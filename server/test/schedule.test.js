import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import test from 'node:test'
import { seal } from '../src/crypto.js'
import { getSubscriber, openDatabase, saveSubscriber } from '../src/db.js'
import { runOnce } from '../src/scheduler.js'
import { addIsoDays } from '../src/term.js'

const key = randomBytes(32)
const NOW = new Date('2026-11-06T06:00:00.000Z')

function prepare(lmp, extra = {}) {
  const db = openDatabase(':memory:')
  saveSubscriber(db, {
    telegram_user_id: 42,
    lmp_enc: seal(key, lmp),
    tz: 'Europe/Moscow',
    send_time: '09:00',
    step: 'ready',
    next_send_at: NOW.toISOString(),
    retry_after: null,
    attempts: 0,
    updated_at: NOW.toISOString(),
    ...extra,
  })
  return db
}

test('ежедневная отправка один раз и следующее время в поясе пользователя', async () => {
  const db = prepare('2026-08-10')
  const sent = []
  const stats = await runOnce({
    db,
    key,
    now: NOW,
    generate: async () => ({ text: '<b>Неделя 12, день 4</b>', source: 'grok' }),
    send: async (message) => sent.push(message),
  })
  assert.equal(stats.sent, 1)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].chatId, 42)
  const row = getSubscriber(db, 42)
  assert.equal(row.step, 'ready')
  assert.equal(row.next_send_at, '2026-11-07T06:00:00.000Z')
  assert.equal(String(row.lmp_enc).includes('2026-08-10'), false)

  const again = await runOnce({
    db,
    key,
    now: NOW,
    generate: async () => { throw new Error('should use delivery guard') },
    send: async () => { throw new Error('second send') },
  })
  assert.equal(again.sent, 0)
  assert.equal(again.skipped, 0)
})

test('на 42 неделе уходит завершение и рассылка останавливается', async () => {
  const db = prepare(addIsoDays('2026-11-06', -294))
  const sent = []
  const stats = await runOnce({
    db,
    key,
    now: NOW,
    generate: async () => { throw new Error('grok should not run') },
    send: async (message) => sent.push(message.text),
  })
  assert.equal(stats.completed, 1)
  assert.match(sent[0], /42 недели/)
  assert.equal(getSubscriber(db, 42).step, 'completed')
  assert.equal(getSubscriber(db, 42).next_send_at, null)
})

test('блокировка бота выключает рассылку, сбой Telegram ставит повтор', async () => {
  const blockedDb = prepare('2026-08-10')
  const blocked = await runOnce({
    db: blockedDb,
    key,
    now: NOW,
    generate: async () => ({ text: 'заметка', source: 'grok' }),
    send: async () => {
      const error = new Error('blocked')
      error.error_code = 403
      throw error
    },
  })
  assert.equal(blocked.blocked, 1)
  assert.equal(getSubscriber(blockedDb, 42).step, 'blocked')
  assert.equal(getSubscriber(blockedDb, 42).next_send_at, null)

  const retryDb = prepare('2026-08-10')
  const retried = await runOnce({
    db: retryDb,
    key,
    now: NOW,
    generate: async () => ({ text: 'заметка', source: 'grok' }),
    send: async () => {
      const error = new Error('unavailable')
      error.error_code = 500
      throw error
    },
  })
  assert.equal(retried.retry, 1)
  const row = getSubscriber(retryDb, 42)
  assert.equal(row.step, 'ready')
  assert.ok(row.retry_after > NOW.toISOString())
})

test('ошибка генерации не срывает отправку: уходит запасной текст', async () => {
  const db = prepare('2026-08-10')
  const sent = []
  const stats = await runOnce({
    db,
    key,
    now: NOW,
    generate: async () => { throw new Error('grok down') },
    send: async (message) => sent.push(message.text),
  })
  assert.equal(stats.fallback, 1)
  assert.match(sent[0], /Неделя 12, день 4/)
  assert.match(sent[0], /врач/)
})
