import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { formatLength, formatWeight } from '../../src/lib/pregnancy.js'

const weeksFile = fileURLToPath(new URL('../../src/data/weeks.json', import.meta.url))
const byWeek = new Map(JSON.parse(readFileSync(weeksFile, 'utf8')).map((item) => [item.week, item]))

const DISCLAIMER = '<i>Это общая информация, не замена консультации врача. Свои вопросы обсудите с врачом, который ведёт беременность.</i>'

export function fallbackMessage(week, day) {
  const head = `<b>Неделя ${week}, день ${day}</b>`
  const card = byWeek.get(week)
  if (!card) {
    return [
      head,
      '',
      'Малыш продолжает расти, и каждый день этого срока немного свой. Точный размер и то, как идёт именно ваша беременность, смотрит врач.',
      '',
      'Самочувствие у всех разное: усталость и тянущие ощущения бывают часто и сами по себе ни о чём не говорят. Сильная боль, кровотечение или рвота, из-за которой не получается пить, — повод связаться с врачом.',
      '',
      'Совет дня: запишите один вопрос, который хотите задать на следующем визите, пока он не забылся.',
      '',
      DISCLAIMER,
    ].join('\n')
  }
  const tip = Array.isArray(card.tip) ? card.tip[0] : card.tip
  return [
    head,
    '',
    `Малыша на этой неделе обычно сравнивают ${card.sizeComparison}. В среднем ориентир такой: ${formatLength(card.lengthCm)} и ${formatWeight(card.weightG)}. ${card.babyDescription}`,
    '',
    card.momDescription,
    '',
    `Совет дня: ${tip}`,
    '',
    DISCLAIMER,
  ].join('\n')
}
