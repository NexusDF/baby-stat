import { DateTime } from 'luxon'

export const TERM_DAYS = 280
export const MAX_GESTATION_DAYS = 42 * 7

export function plural(n, forms) {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last === 1) return forms[0]
  if (last > 1 && last < 5) return forms[1]
  return forms[2]
}

export function isIsoDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return false
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function addIsoDays(iso, days) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function diffIso(from, to) {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  return Math.round((end - start) / 86400000)
}

export function todayIso(zone, now = new Date()) {
  const local = DateTime.fromJSDate(now, { zone: 'utc' }).setZone(zone)
  if (!local.isValid) return null
  return local.toISODate()
}

export function trimesterOf(week) {
  if (week <= 13) return 1
  if (week <= 27) return 2
  return 3
}

export function termFrom(lmp, today) {
  const days = diffIso(lmp, today)
  const weeks = Math.floor(days / 7)
  const extra = days % 7
  return {
    lmp,
    days,
    weeks,
    extra,
    due: addIsoDays(lmp, TERM_DAYS),
    trimester: trimesterOf(weeks),
    finished: days >= MAX_GESTATION_DAYS,
  }
}

export function parseDateInput(text) {
  const raw = String(text || '').trim()
  const ru = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw)
  if (ru) {
    const iso = `${ru[3]}-${ru[2]}-${ru[1]}`
    return isIsoDate(iso) ? iso : null
  }
  return isIsoDate(raw) ? raw : null
}

export function parseTime(text) {
  const match = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(String(text || ''))
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function validateLmp(iso, today) {
  if (!isIsoDate(iso)) return { ok: false, reason: 'format' }
  const days = diffIso(iso, today)
  if (days < 0) return { ok: false, reason: 'future' }
  if (days > MAX_GESTATION_DAYS) return { ok: false, reason: 'too_old' }
  return { ok: true, term: termFrom(iso, today) }
}

export function formatRuIso(iso) {
  const [year, month, day] = iso.split('-')
  return `${day}.${month}.${year}`
}

export function termSentence(term) {
  const weeks = `${term.weeks} ${plural(term.weeks, ['неделя', 'недели', 'недель'])}`
  const days = `${term.extra} ${plural(term.extra, ['день', 'дня', 'дней'])}`
  return `Ваш срок: ${weeks} ${days}, ориентировочная дата родов — ${formatRuIso(term.due)}.`
}

// Следующее локальное ЧЧ:ММ строго после `after`, в UTC ISO.
export function nextSendAt(zone, hhmm, after = new Date()) {
  const parsed = parseTime(hhmm)
  if (!parsed) return null
  const [hour, minute] = parsed.split(':').map(Number)
  const localNow = DateTime.fromJSDate(after, { zone: 'utc' }).setZone(zone)
  if (!localNow.isValid) return null
  let candidate = localNow.set({ hour, minute, second: 0, millisecond: 0 })
  if (candidate <= localNow) candidate = candidate.plus({ days: 1 })
  return candidate.toUTC().toJSDate().toISOString()
}

export function localDate(utcIso, zone) {
  const local = DateTime.fromISO(utcIso, { zone: 'utc' }).setZone(zone)
  if (!local.isValid) return null
  return local.toISODate()
}
