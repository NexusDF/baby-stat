import WEEK_LIST from './weeks.json'

const byWeek = new Map(WEEK_LIST.map((item) => [item.week, item]))

export function allWeeks() {
  return WEEK_LIST
}

export function getWeek(week) {
  const safe = Math.min(40, Math.max(4, Math.round(Number(week))))
  return byWeek.get(safe)
}

export function weeksByTrimester() {
  return [
    { id: 1, title: 'I триместр', weeks: WEEK_LIST.filter((item) => item.trimester === 1) },
    { id: 2, title: 'II триместр', weeks: WEEK_LIST.filter((item) => item.trimester === 2) },
    { id: 3, title: 'III триместр', weeks: WEEK_LIST.filter((item) => item.trimester === 3) },
  ]
}
