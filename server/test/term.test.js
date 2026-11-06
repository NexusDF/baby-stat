import assert from 'node:assert/strict'
import test from 'node:test'
import { addIsoDays, nextSendAt, termFrom, termSentence, validateLmp } from '../src/term.js'

const TODAY = '2026-11-06'

test('акушерский срок и ПДР от первого дня месячных', () => {
  const lmp = '2026-08-10'
  const term = termFrom(lmp, TODAY)
  assert.equal(term.weeks, 12)
  assert.equal(term.extra, 4)
  assert.equal(term.due, addIsoDays(lmp, 280))
  assert.equal(term.trimester, 1)
  assert.equal(term.finished, false)
  assert.match(termSentence(term), /^Ваш срок: 12 недель 4 дня, ориентировочная дата родов — \d{2}\.\d{2}\.\d{4}\.$/)
})

test('дата в будущем и старше 42 недель не принимается, ровно 42 недели — конец рассылки', () => {
  assert.equal(validateLmp('2026-11-07', TODAY).reason, 'future')
  assert.equal(validateLmp(addIsoDays(TODAY, -295), TODAY).reason, 'too_old')
  const edge = validateLmp(addIsoDays(TODAY, -294), TODAY)
  assert.equal(edge.ok, true)
  assert.equal(edge.term.finished, true)
  assert.equal(edge.term.weeks, 42)
  assert.equal(edge.term.extra, 0)
})

test('следующая отправка считается в часовом поясе пользователя', () => {
  const morning = new Date('2026-11-06T05:00:00.000Z')
  assert.equal(nextSendAt('Europe/Moscow', '09:00', morning), '2026-11-06T06:00:00.000Z')
  const after = new Date('2026-11-06T07:00:00.000Z')
  assert.equal(nextSendAt('Europe/Moscow', '09:00', after), '2026-11-07T06:00:00.000Z')
  const vladivostok = new Date('2026-11-06T22:30:00.000Z')
  assert.equal(nextSendAt('Asia/Vladivostok', '09:00', vladivostok), '2026-11-06T23:00:00.000Z')
})
