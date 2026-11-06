import { interpretTerm, toISODate } from './pregnancy.js'

const MAX_GESTATION_DAYS = 42 * 7
const CLIENT_KEY = 'baby-stat-client'
export const DEFAULT_BOT = 'bulo44kaa_bot'

function isLoopback(host) {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}

// Адрес 127.0.0.1 с телефона — это сам телефон, а не компьютер, где запущен сервис ссылок.
export function usableApiBase(apiBase, pageHost = '') {
  if (!apiBase) return ''
  try {
    const host = new URL(apiBase).hostname
    if (isLoopback(host) && pageHost && !isLoopback(pageHost)) return ''
  } catch {
    return ''
  }
  return apiBase
}

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

export function isPhone(userAgent = '', maxTouchPoints = 0) {
  if (/Android|iPhone|iPad|iPod/i.test(userAgent)) return true
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1
}

// iPhone открывает приложение схемой tg://. Android — intent, и если Telegram
// не установлен, сам уходит на https. https://t.me из window.open телефон блокирует.
export function phoneTargets(httpsUrl, userAgent = '') {
  const url = new URL(httpsUrl)
  const domain = url.pathname.replace(/^\//, '')
  const start = url.searchParams.get('start')
  const startQuery = start ? `&start=${encodeURIComponent(start)}` : ''
  if (/Android/i.test(userAgent)) {
    const fallback = encodeURIComponent(httpsUrl)
    return {
      primary: `intent://resolve?domain=${encodeURIComponent(domain)}${startQuery}#Intent;scheme=tg;package=org.telegram.messenger;S.browser_fallback_url=${fallback};end`,
      fallback: null,
    }
  }
  return {
    primary: `tg://resolve?domain=${encodeURIComponent(domain)}${startQuery}`,
    fallback: httpsUrl,
  }
}

export function launchPhone(httpsUrl, userAgent = '', deps = {}) {
  const assign = deps.assign || ((next) => window.location.assign(next))
  const { primary, fallback } = phoneTargets(httpsUrl, userAgent)
  if (!fallback) {
    assign(primary)
    return
  }
  const doc = deps.document || document
  const schedule = deps.setTimeout || window.setTimeout.bind(window)
  const cancel = deps.clearTimeout || window.clearTimeout.bind(window)
  const timer = schedule(() => {
    if (!doc.hidden) assign(fallback)
  }, 900)
  const stop = () => cancel(timer)
  doc.addEventListener?.('visibilitychange', () => {
    if (doc.hidden) stop()
  }, { once: true })
  doc.defaultView?.addEventListener?.('pagehide', stop, { once: true })
  assign(primary)
}
