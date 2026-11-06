import { InlineKeyboard } from 'grammy'
import { addIsoDays } from './term.js'
import { ZONES } from './zones.js'

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const TIMES = ['08:00', '09:00', '12:00', '15:00', '18:00', '21:00']

function shiftMonth(year, month, delta) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1))
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 }
}

export function calendarKeyboard(monthIso, today) {
  const [year, month] = monthIso.split('-').map(Number)
  const minIso = addIsoDays(today, -42 * 7)
  const kb = new InlineKeyboard()
  for (const name of WEEKDAYS) kb.text(name, 'noop')
  kb.row()

  const firstDow = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate()
  let column = 0
  for (let i = 0; i < firstDow; i += 1) {
    kb.text('·', 'noop')
    column += 1
  }
  for (let day = 1; day <= days; day += 1) {
    const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const ok = iso >= minIso && iso <= today
    kb.text(ok ? String(day) : '·', ok ? `d:${iso}` : 'noop')
    column += 1
    if (column === 7) {
      kb.row()
      column = 0
    }
  }
  if (column) {
    while (column < 7) {
      kb.text('·', 'noop')
      column += 1
    }
    kb.row()
  }

  const prev = shiftMonth(year, month, -1)
  const next = shiftMonth(year, month, 1)
  const prevEnd = new Date(Date.UTC(prev.year, prev.month, 0)).toISOString().slice(0, 10)
  const nextStart = `${next.year}-${String(next.month).padStart(2, '0')}-01`
  if (prevEnd >= minIso) kb.text('‹', `n:${prev.year}-${String(prev.month).padStart(2, '0')}`)
  kb.text(`${MONTHS[month - 1]} ${year}`, 'noop')
  if (nextStart <= today) kb.text('›', `n:${next.year}-${String(next.month).padStart(2, '0')}`)
  return kb
}

export function timeKeyboard() {
  const kb = new InlineKeyboard()
  TIMES.forEach((time, index) => {
    kb.text(time === '09:00' ? '09:00 · обычно' : time, `tm:${time}`)
    if (index % 2 === 1) kb.row()
  })
  return kb
}

export function zonesKeyboard() {
  const kb = new InlineKeyboard()
  ZONES.forEach((zone, index) => {
    kb.text(zone.label, `tz:${zone.id}`)
    if (index % 2 === 1) kb.row()
  })
  return kb
}

export function settingsKeyboard() {
  return new InlineKeyboard()
    .text('Дата', 'act:date')
    .text('Время', 'act:time')
    .text('Город', 'act:tz')
}

export function stopKeyboard() {
  return new InlineKeyboard().text('Да, удалить', 'stop:yes').text('Оставить', 'stop:no')
}

export function changeDateKeyboard() {
  return new InlineKeyboard().text('Изменить дату', 'act:date')
}

export function keyboardFor(spec, today) {
  if (!spec) return undefined
  if (spec.type === 'calendar') return calendarKeyboard(spec.month, today)
  if (spec.type === 'time') return timeKeyboard()
  if (spec.type === 'zones') return zonesKeyboard()
  if (spec.type === 'settings') return settingsKeyboard()
  if (spec.type === 'stop') return stopKeyboard()
  if (spec.type === 'change-date') return changeDateKeyboard()
  return undefined
}
