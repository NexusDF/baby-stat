import { interpretTerm, toISODate } from './pregnancy.js'

const MAX_GESTATION_DAYS = 42 * 7
const CLIENT_KEY = 'baby-stat-client'

export function shareableLmp(source, iso, now = new Date()) {
  const term = interpretTerm(source, iso, now)
  if (term.status !== 'ok' || !term.lmp) return null
  if (term.days > MAX_GESTATION_DAYS) return null
  return toISODate(term.lmp)
}

export function rememberClientId(storage = globalThis.localStorage) {
  const current = storage?.getItem(CLIENT_KEY) || ''
  if (/^[A-Za-z0-9_-]{16,64}$/.test(current)) return current
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  const id = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
  storage?.setItem(CLIENT_KEY, id)
  return id
}

export function botStartUrl(username, payload) {
  const name = String(username || '').replace(/^@/, '').trim()
  if (!name) return ''
  const base = `https://t.me/${name}`
  if (!payload) return base
  return `${base}?start=${payload}`
}

export async function buildDailyLink({
  username,
  apiBase,
  lmp,
  clientId,
  fetchImpl = globalThis.fetch,
}) {
  const plain = botStartUrl(username)
  if (!plain) return { error: 'unconfigured' }
  if (!apiBase) return { url: plain, hasDate: false, via: 'direct' }

  try {
    const response = await fetchImpl(`${String(apiBase).replace(/\/$/, '')}/v1/telegram/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lmp: lmp || null, clientId: clientId || null }),
    })
    if (!response.ok) return { url: plain, hasDate: false, via: 'fallback' }
    const data = await response.json()
    if (typeof data.url !== 'string' || !data.url.startsWith('https://t.me/')) {
      return { url: plain, hasDate: false, via: 'fallback' }
    }
    if (lmp && data.url.includes(lmp)) return { url: plain, hasDate: false, via: 'fallback' }
    return { url: data.url, hasDate: Boolean(data.hasDate) && Boolean(lmp), via: 'token' }
  } catch {
    return { url: plain, hasDate: false, via: 'fallback' }
  }
}

export function openTelegram(url) {
  const opened = window.open(url, '_blank', 'noopener,noreferrer')
  return Boolean(opened)
}
