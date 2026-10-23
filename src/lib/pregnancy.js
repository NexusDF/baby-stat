const WEEK_MS = 24 * 60 * 60 * 1000

export function plural(n, forms) {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last === 1) return forms[0]
  if (last > 1 && last < 5) return forms[1]
  return forms[2]
}

export function weeksPhrase(weeks, days = null) {
  const weekText = `${weeks}\u00A0${plural(weeks, ['неделя', 'недели', 'недель'])}`
  if (days == null || days === 0) return weekText
  return `${weekText} ${days}\u00A0${plural(days, ['день', 'дня', 'дней'])}`
}

export function parseISODate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

export function toISODate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

export function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  next.setDate(next.getDate() + days)
  return next
}

export function diffDays(from, to) {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
  return Math.round((end - start) / WEEK_MS)
}

export function gestationalAge(iso, today = new Date()) {
  const lmp = parseISODate(iso)
  if (!lmp) return null
  const days = diffDays(lmp, today)
  return {
    days,
    weeks: Math.floor(days / 7),
    extra: days < 0 ? 0 : days % 7,
    due: addDays(lmp, 280),
  }
}

export function focusWeek(iso, today = new Date()) {
  const age = gestationalAge(iso, today)
  if (!age || age.days < 0) return null
  if (age.weeks < 4) return 4
  return Math.min(40, age.weeks)
}

export function trimesterName(week) {
  if (week <= 13) return 'I триместр'
  if (week <= 27) return 'II триместр'
  return 'III триместр'
}

export function trimesterSegments(week) {
  const parts = [
    { id: 1, label: 'I', from: 1, to: 13 },
    { id: 2, label: 'II', from: 14, to: 27 },
    { id: 3, label: 'III', from: 28, to: 40 },
  ]
  return parts.map((part) => {
    const span = part.to - part.from + 1
    let fill = 0
    if (week >= part.to) fill = 1
    else if (week >= part.from) fill = (week - part.from + 1) / span
    return {
      ...part,
      fill,
      active: week >= part.from && week <= part.to,
    }
  })
}

export function formatDate(date) {
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function formatLength(mm) {
  if (mm < 10) return `${mm}\u00A0мм`
  const cm = Math.round(mm) / 10
  const text = Number.isInteger(cm)
    ? String(cm)
    : cm.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${text}\u00A0см`
}

export function formatWeight(grams) {
  if (grams < 1) return 'менее\u00A01\u00A0г'
  if (grams < 1000) return `${Math.round(grams)}\u00A0г`
  const kilos = grams / 1000
  const text = kilos.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${text}\u00A0кг`
}

export function measureLabel(kind) {
  return kind === 'crl' ? 'КТР' : 'Рост'
}

export function measureHint(kind) {
  return kind === 'crl' ? 'от макушки до копчика' : 'от макушки до пяток'
}

export function sizeLine(week) {
  const noun = week.week <= 8 ? 'Эмбрион' : 'Малыш'
  return `${noun} размером примерно с ${week.like}`
}
