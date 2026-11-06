import { getCachedMessage, putCachedMessage } from './db.js'
import { fallbackMessage } from './fallback.js'
import { SYSTEM_PROMPT } from './prompt.js'

export function sanitizeTelegramHtml(input) {
  const withoutFences = String(input || '').replace(/```(?:html)?/gi, '').trim()
  const withBreaks = withoutFences.replace(/<\s*br\s*\/?\s*>/gi, '\n')
  const tagged = withBreaks.replace(/<\s*(\/)?\s*(b|i)\s*>/gi, (_, slash, tag) => (
    slash ? `</${tag.toLowerCase()}>` : `<${tag.toLowerCase()}>`
  ))
  const protectedText = tagged
    .replaceAll('<b>', '\u0001')
    .replaceAll('</b>', '\u0002')
    .replaceAll('<i>', '\u0003')
    .replaceAll('</i>', '\u0004')
  const escaped = protectedText
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
  return escaped
    .replaceAll('\u0001', '<b>')
    .replaceAll('\u0002', '</b>')
    .replaceAll('\u0003', '<i>')
    .replaceAll('\u0004', '</i>')
    .trim()
}

export function visibleLength(html) {
  return html
    .replace(/<[^>]+>/g, '')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .length
}

export function messageFits(html, week) {
  const length = visibleLength(html)
  const header = new RegExp(`Неделя ${week}(?!\\d)`)
  return length >= 600 && length <= 900 && header.test(html)
}

async function requestGrok({ fetchImpl, apiKey, model, week, day, trimester }) {
  const response = await fetchImpl('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Неделя: ${week}\nДень: ${day}\nТриместр: ${trimester}` },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) {
    const error = new Error(`grok ${response.status}`)
    error.status = response.status
    throw error
  }
  const payload = await response.json()
  const text = payload?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) throw new Error('grok empty')
  return text
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function generateDailyMessage({
  db,
  apiKey,
  model,
  week,
  day,
  trimester,
  fetchImpl = fetch,
  pause = sleep,
  now = new Date(),
}) {
  const cached = getCachedMessage(db, week, day)
  if (cached) return { text: cached, source: 'cache' }

  if (apiKey) {
    let lastStatus = 0
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const clean = sanitizeTelegramHtml(await requestGrok({
          fetchImpl, apiKey, model, week, day, trimester,
        }))
        if (messageFits(clean, week)) {
          putCachedMessage(db, week, day, clean, now.toISOString())
          return { text: clean, source: 'grok' }
        }
        lastStatus = 0
      } catch (error) {
        lastStatus = error.status || 0
        if (lastStatus >= 400 && lastStatus < 500 && lastStatus !== 429) break
      }
      if (attempt < 2) await pause(500 * 2 ** attempt)
    }
  }

  return { text: fallbackMessage(week, day), source: 'fallback' }
}
