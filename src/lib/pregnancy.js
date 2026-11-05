const DAY_MS = 24 * 60 * 60 * 1000
const TERM_DAYS = 280

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return null
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
  return Math.round((end - start) / DAY_MS)
}

export function trimesterOf(week) {
  if (week <= 13) return 1
  if (week <= 27) return 2
  return 3
}

export function trimesterName(week) {
  const names = { 1: 'I триместр', 2: 'II триместр', 3: 'III триместр' }
  return names[trimesterOf(week)]
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

// До 20-й недели в данных КТР, он часто меньше 1 см — такие значения показываем в миллиметрах.
export function formatLength(cm) {
  if (cm < 1) {
    const mm = Math.round(cm * 10)
    return `${mm}\u00A0мм`
  }
  const rounded = Math.round(cm * 10) / 10
  const text = Number.isInteger(rounded)
    ? String(rounded)
    : rounded.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${text}\u00A0см`
}

export function formatWeight(grams) {
  if (grams < 1) return 'менее\u00A01\u00A0г'
  const text = Math.round(grams).toLocaleString('ru-RU')
  return `${text}\u00A0г`
}

export function lengthLabel(week) {
  return week < 20 ? 'КТР' : 'Рост'
}

export function lengthHint(week) {
  return week < 20 ? 'от макушки до копчика' : 'от макушки до пяток'
}

export function countdownPhrase(days) {
  if (days === 0) return 'Предполагаемая дата родов — сегодня'
  if (days > 0) {
    const weeks = Math.floor(days / 7)
    const extra = days % 7
    if (weeks === 0) {
      return `До предполагаемых родов ${extra}\u00A0${plural(extra, ['день', 'дня', 'дней'])}`
    }
    return `До предполагаемых родов ${weeksPhrase(weeks, extra)}`
  }
  const late = -days
  if (late === 1) return 'Расчётный день родов был вчера'
  return `Расчётный день родов был ${late}\u00A0${plural(late, ['день', 'дня', 'дней'])} назад`
}

// source: 'lmp' (первый день менструации) или 'edd' (ПДР). Срок = ПДР минус 280 дней.
export function interpretTerm(source, iso, today = new Date()) {
  if (!iso) return { status: 'empty' }
  const date = parseISODate(iso)
  if (!date || (source !== 'lmp' && source !== 'edd')) return { status: 'invalid' }

  const lmp = source === 'edd' ? addDays(date, -TERM_DAYS) : date
  const due = source === 'edd' ? date : addDays(date, TERM_DAYS)
  const days = diffDays(lmp, today)
  if (days < 0) return { status: 'future', lmp, due, days }

  const weeks = Math.floor(days / 7)
  const extra = days % 7
  let focus = weeks
  if (weeks < 4) focus = 4
  if (weeks > 40) focus = 40

  return {
    status: 'ok',
    lmp,
    due,
    days,
    weeks,
    extra,
    countdown: diffDays(today, due),
    focus,
  }
}

export function termMessage(term, selectedWeek) {
  if (!term || term.status === 'empty') return ''
  if (term.status === 'invalid') return 'Не получилось прочитать дату. Выберите день в календаре ещё раз.'
  if (term.status === 'future') {
    return 'Эта дата ещё впереди. Нужен первый день уже начавшихся месячных или предполагаемая дата родов текущей беременности.'
  }
  if (term.weeks < 4) {
    const base = `По этой дате сейчас ${weeksPhrase(term.weeks, term.extra)}. Карточки начинаются с 4-й недели.`
    return selectedWeek === 4 ? `${base} Открыта она.` : base
  }
  if (term.weeks > 40) {
    return `По этой дате ${weeksPhrase(term.weeks, term.extra)}. Здесь ориентиры 40-й недели: дальше срок у каждой свой, его смотрит врач.`
  }
  if (term.weeks !== selectedWeek && term.weeks <= 40) {
    return `Сейчас ${weeksPhrase(term.weeks, term.extra)}.`
  }
  return ''
}
