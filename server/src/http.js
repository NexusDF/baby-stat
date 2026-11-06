import { createServer } from 'node:http'
import { hashToken, newToken, seal } from './crypto.js'
import { insertToken, purgeTokens } from './db.js'
import { log } from './log.js'
import { todayIso, validateLmp } from './term.js'

const CLIENT_RE = /^[A-Za-z0-9_-]{8,64}$/

function allowOrigin(origin, origins) {
  if (!origin) return null
  if (origins.includes(origin)) return origin
  try {
    const url = new URL(origin)
    if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) return origin
  } catch {
    return null
  }
  return null
}

function sendJson(res, status, payload, origin) {
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(payload))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 2048) {
        reject(new Error('too-large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8')
        resolve(raw ? JSON.parse(raw) : {})
      } catch {
        reject(new Error('json'))
      }
    })
    req.on('error', reject)
  })
}

function limited(hits, ip) {
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((stamp) => now - stamp < 60_000)
  if (recent.length >= 20) {
    hits.set(ip, recent)
    return true
  }
  recent.push(now)
  hits.set(ip, recent)
  return false
}

export function startHttp({ db, key, port, host, origins, botUsername, tokenTtlMs }) {
  const hits = new Map()
  const server = createServer(async (req, res) => {
    const origin = allowOrigin(req.headers.origin, origins)
    if (req.method === 'OPTIONS') {
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin)
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
        res.setHeader('Vary', 'Origin')
      }
      res.writeHead(204)
      res.end()
      return
    }
    if (req.method !== 'POST' || req.url !== '/v1/telegram/link') {
      sendJson(res, 404, { error: 'not_found' }, origin)
      return
    }
    if (!botUsername) {
      sendJson(res, 503, { error: 'unconfigured' }, origin)
      return
    }
    if (limited(hits, req.socket.remoteAddress || 'unknown')) {
      sendJson(res, 429, { error: 'rate' }, origin)
      return
    }

    let body
    try {
      body = await readBody(req)
    } catch {
      sendJson(res, 400, { error: 'body' }, origin)
      return
    }

    const lmp = body?.lmp == null || body.lmp === '' ? null : body.lmp
    if (lmp != null && typeof lmp !== 'string') {
      sendJson(res, 400, { error: 'format' }, origin)
      return
    }
    const clientId = typeof body?.clientId === 'string' && CLIENT_RE.test(body.clientId) ? body.clientId : null
    let stored = null
    if (lmp) {
      const check = validateLmp(lmp, todayIso('Europe/Moscow'))
      if (!check.ok) {
        sendJson(res, 422, { error: 'date' }, origin)
        return
      }
      stored = seal(key, lmp)
    }

    const token = newToken()
    const now = new Date()
    insertToken(db, {
      tokenHash: hashToken(token),
      lmpEnc: stored,
      clientId,
      expiresAt: new Date(now.getTime() + tokenTtlMs).toISOString(),
    })
    if (Math.random() < 0.02) purgeTokens(db, now.toISOString())
    log.info('issued telegram start link')
    sendJson(res, 200, { url: `https://t.me/${botUsername}?start=${token}`, hasDate: Boolean(lmp) }, origin)
  })

  return new Promise((resolve) => {
    server.listen(port, host, () => resolve(server))
  })
}
