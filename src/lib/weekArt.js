import week04 from '../assets/fetus/week-04.jpg'
import week05 from '../assets/fetus/week-05.jpg'
import week06 from '../assets/fetus/week-06.jpg'
import week07 from '../assets/fetus/week-07.jpg'
import week08 from '../assets/fetus/week-08.jpg'
import week10 from '../assets/fetus/week-10.jpg'
import week12 from '../assets/fetus/week-12.jpg'
import week14 from '../assets/fetus/week-14.jpg'
import week16 from '../assets/fetus/week-16.jpg'
import week20 from '../assets/fetus/week-20.jpg'
import week24 from '../assets/fetus/week-24.jpg'
import week28 from '../assets/fetus/week-28.jpg'
import week32 from '../assets/fetus/week-32.jpg'
import week36 from '../assets/fetus/week-36.jpg'
import week40 from '../assets/fetus/week-40.jpg'

const KEYS = [
  { week: 4, src: week04 },
  { week: 5, src: week05 },
  { week: 6, src: week06 },
  { week: 7, src: week07 },
  { week: 8, src: week08 },
  { week: 10, src: week10 },
  { week: 12, src: week12 },
  { week: 14, src: week14 },
  { week: 16, src: week16 },
  { week: 20, src: week20 },
  { week: 24, src: week24 },
  { week: 28, src: week28 },
  { week: 32, src: week32 },
  { week: 36, src: week36 },
  { week: 40, src: week40 },
]

const TERM_MM = 514

export function visualScale(mm) {
  const ratio = Math.min(1, Math.max(mm, 1) / TERM_MM)
  return 0.58 + 0.42 * Math.pow(ratio, 0.55)
}

export function weekArt(week) {
  const safe = Math.min(40, Math.max(4, Math.round(week)))
  let best = KEYS[0]
  let dist = Math.abs(safe - best.week)
  for (const item of KEYS) {
    const next = Math.abs(safe - item.week)
    if (next < dist) {
      best = item
      dist = next
    }
  }
  return best.src
}
