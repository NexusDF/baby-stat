// Картинки лежат рядом: week-04.jpg … week-40.jpg.
// Если для недели есть и svg-заглушка, и jpg/png/webp, показывается растровая —
// готовый файл можно просто положить в папку, не правя этот модуль.
const modules = import.meta.glob('../assets/fetus/week-*.{jpg,jpeg,png,webp,svg}', {
  eager: true,
  import: 'default',
})

const RANK = { svg: 0, png: 1, webp: 2, jpeg: 3, jpg: 3 }
const byWeek = new Map()

for (const [path, src] of Object.entries(modules)) {
  const match = path.match(/week-(\d+)\.(jpg|jpeg|png|webp|svg)$/i)
  if (!match) continue
  const week = Number(match[1])
  const ext = match[2].toLowerCase()
  const prev = byWeek.get(week)
  if (!prev || RANK[ext] >= prev.rank) byWeek.set(week, { src, rank: RANK[ext] })
}

// Лёгкий рост от недели к неделе. Сами файлы уже скомпонованы крупно,
// поэтому масштаб почти стабильный и не прыгает на 20-й неделе,
// когда КТР сменяется ростом от макушки до пяток.
export function visualScale(week) {
  const t = (Math.min(40, Math.max(4, week)) - 4) / 36
  return 0.9 + 0.1 * t
}

export function weekArt(imageName, week) {
  const exact = Object.entries(modules).find(([path]) => path.endsWith(`/${imageName}`))
  if (exact && !imageName.endsWith('.svg')) return exact[1]
  return byWeek.get(week)?.src ?? exact?.[1] ?? ''
}
