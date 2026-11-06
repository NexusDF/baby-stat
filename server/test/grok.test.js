import assert from 'node:assert/strict'
import test from 'node:test'
import { openDatabase } from '../src/db.js'
import { generateDailyMessage, messageFits, sanitizeTelegramHtml, visibleLength } from '../src/grok.js'
import { SYSTEM_PROMPT } from '../src/prompt.js'

function draft(week, day, extra = '') {
  const body = `<b>Неделя ${week}, день ${day}</b>\n\nМалыш растёт спокойно, и этот день у него свой. ${extra}`
  const pad = 'Это общий ориентир, без назначений. '
  return body + pad.repeat(Math.ceil((700 - visibleLength(body)) / pad.length))
}

test('промпт держит тон, длину, HTML и запрет назначений', () => {
  assert.match(SYSTEM_PROMPT, /на «вы»/)
  assert.match(SYSTEM_PROMPT, /600 до 900/)
  assert.match(SYSTEM_PROMPT, /Telegram HTML/)
  assert.match(SYSTEM_PROMPT, /Не ставь диагнозов/)
  assert.match(SYSTEM_PROMPT, /лекарства/)
  assert.match(SYSTEM_PROMPT, /не замена консультации врача/)
  assert.match(SYSTEM_PROMPT, /Неделя N, день M/)
})

test('ответ Grok чистится, кешируется по неделе и дню и не повторяет запрос', async () => {
  const db = openDatabase(':memory:')
  const text = draft(12, 3)
  assert.equal(messageFits(sanitizeTelegramHtml(`${text}\n\n<script>alert(1)</script>`), 12), true)
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: `${text}\n\n<script>alert(1)</script>` } }] }),
    }
  }
  const first = await generateDailyMessage({
    db, apiKey: 'test', model: 'grok-4.7', week: 12, day: 3, trimester: 1, fetchImpl, pause: async () => {},
  })
  const second = await generateDailyMessage({
    db, apiKey: 'test', model: 'grok-4.7', week: 12, day: 3, trimester: 1, fetchImpl, pause: async () => {},
  })
  assert.equal(first.source, 'grok')
  assert.equal(second.source, 'cache')
  assert.equal(second.text, first.text)
  assert.equal(calls, 1)
  assert.equal(first.text.includes('<script>'), false)
  assert.equal(first.text.includes('Неделя 12'), true)
})

test('сбой Grok повторяется и затем заменяется запасным текстом', async () => {
  const db = openDatabase(':memory:')
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return { ok: false, status: 503, json: async () => ({}) }
  }
  const result = await generateDailyMessage({
    db, apiKey: 'test', model: 'grok-4.7', week: 12, day: 3, trimester: 1, fetchImpl, pause: async () => {},
  })
  assert.equal(calls, 3)
  assert.equal(result.source, 'fallback')
  assert.match(result.text, /Неделя 12, день 3/)
  assert.equal(result.text.includes('2026-'), false)
})

test('короткий ответ не кешируется', async () => {
  const db = openDatabase(':memory:')
  let calls = 0
  const fetchImpl = async () => {
    calls += 1
    return { ok: true, json: async () => ({ choices: [{ message: { content: '<b>Неделя 12, день 3</b> мало' } }] }) }
  }
  const result = await generateDailyMessage({
    db, apiKey: 'test', model: 'grok-4.7', week: 12, day: 3, trimester: 1, fetchImpl, pause: async () => {},
  })
  assert.equal(calls, 3)
  assert.equal(result.source, 'fallback')
})
