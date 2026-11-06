import assert from 'node:assert/strict'
import test from 'node:test'
import { addIsoDays, termSentence } from '../src/term.js'
import { planCallback, planCommand, planStart, planText } from '../src/flow.js'

const TODAY = '2026-11-06'

function readyUser() {
  return {
    telegram_user_id: 7,
    lmp: '2026-08-10',
    tz: 'Europe/Moscow',
    send_time: '09:00',
    step: 'ready',
    next_send_at: '2026-11-07T06:00:00.000Z',
    retry_after: null,
    attempts: 0,
  }
}

test('старт без даты просит ввести её и даёт календарь', () => {
  const plan = planStart({ user: null, token: null, today: TODAY })
  assert.equal(plan.user.step, 'need_date')
  assert.match(plan.messages[0].text, /ДД\.ММ\.ГГГГ/)
  assert.equal(plan.messages[0].keyboard.type, 'calendar')
})

test('неверная, будущая и слишком старая дата объясняются и спрашиваются снова', () => {
  const user = { ...planStart({ user: null, token: null, today: TODAY }).user, telegram_user_id: 1 }
  assert.match(planText({ user, text: '31.02.2026', today: TODAY }).messages[0].text, /формате/)
  assert.match(planText({ user, text: '07.11.2026', today: TODAY }).messages[0].text, /впереди/)
  assert.match(planText({ user, text: '01.01.2025', today: TODAY }).messages[0].text, /42 недель/)
})

test('верная дата подтверждает срок, затем время и город', () => {
  let user = { telegram_user_id: 1, lmp: null, tz: null, send_time: null, step: 'need_date' }
  let plan = planText({ user, text: '10.08.2026', today: TODAY })
  assert.match(plan.messages[0].text, /^Ваш срок: 12 недель 4 дня/)
  assert.equal(plan.user.step, 'need_time')
  plan = planText({ user: plan.user, text: '9:00', today: TODAY })
  assert.equal(plan.user.step, 'need_tz')
  plan = planCallback({ user: plan.user, data: 'tz:Asia/Vladivostok', today: TODAY })
  assert.equal(plan.user.step, 'ready')
  assert.equal(plan.user.tz, 'Asia/Vladivostok')
  assert.equal(plan.user.send_time, '09:00')
  assert.equal(plan.user.reschedule, true)
})

test('ссылка с датой сохраняет срок, протухшая ссылка дату не подставляет', () => {
  const linked = planStart({
    user: null,
    token: { valid: true, lmp: '2026-08-10' },
    today: TODAY,
  })
  assert.equal(linked.user.lmp, '2026-08-10')
  assert.match(linked.messages[0].text, new RegExp(termSentence({
    weeks: 12,
    extra: 4,
    due: '2027-05-17',
  }).slice(0, 20)))

  const stale = planStart({ user: null, token: { valid: false }, today: TODAY })
  assert.equal(stale.user.lmp, null)
  assert.match(stale.messages[0].text, /устарела/)
})

test('пауза, смена города и конец срока', () => {
  const paused = planCommand({ user: readyUser(), command: 'pause', today: TODAY })
  assert.equal(paused.user.step, 'paused')
  assert.equal(paused.user.lmp, '2026-08-10')

  const moved = planCallback({ user: paused.user, data: 'tz:Asia/Vladivostok', today: TODAY })
  assert.equal(moved.user.step, 'paused')
  assert.equal(moved.user.tz, 'Asia/Vladivostok')

  const resumed = planCommand({ user: moved.user, command: 'resume', today: TODAY })
  assert.equal(resumed.user.step, 'ready')
  assert.equal(resumed.user.reschedule, true)

  const late = planText({
    user: readyUser(),
    text: addIsoDays(TODAY, -294).split('-').reverse().join('.'),
    today: TODAY,
  })
  assert.equal(late.user.step, 'completed')
  assert.match(late.messages.at(-1).text, /42 недели/)
})

test('/stop удаляет данные только после подтверждения, /today готовит заметку', () => {
  const ask = planCommand({ user: readyUser(), command: 'stop', today: TODAY })
  assert.equal(ask.user.step, 'ready')
  assert.equal(ask.user.lmp, '2026-08-10')
  const gone = planCallback({ user: ask.user, data: 'stop:yes', today: TODAY })
  assert.equal(gone.user, null)

  const today = planCommand({ user: readyUser(), command: 'today', today: TODAY })
  assert.equal(today.action, 'send-today')
})
