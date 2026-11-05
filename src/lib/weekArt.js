// Готовые иллюстрации: illustrations/week_04.png … week_40.png.
// Старые week-04.jpg и svg остаются запасным вариантом, если png для недели нет.
const modules = import.meta.glob(
  [
    '../assets/fetus/illustrations/week_*.png',
    '../assets/fetus/week-*.{jpg,jpeg,png,webp,svg}',
  ],
  { eager: true, import: 'default' },
)

const RANK = { svg: 0, jpg: 1, jpeg: 1, webp: 2, png: 3 }
const byWeek = new Map()

for (const [path, src] of Object.entries(modules)) {
  const match = path.match(/week[_-](\d+)\.(jpg|jpeg|png|webp|svg)$/i)
  if (!match) continue
  const week = Number(match[1])
  const ext = match[2].toLowerCase()
  const prev = byWeek.get(week)
  if (!prev || RANK[ext] > prev.rank) byWeek.set(week, { src, rank: RANK[ext] })
}

// Размер малыша уже заложен в каждую иллюстрацию, поэтому рамку не масштабируем.
export function visualScale() {
  return 1
}

export function weekArt(imageName, week) {
  const picked = byWeek.get(week)
  if (picked) return picked.src
  const exact = Object.entries(modules).find(([path]) => path.endsWith(`/${imageName}`))
  return exact?.[1] ?? ''
}
