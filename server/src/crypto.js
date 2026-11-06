import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

export function parseDataKey(raw) {
  const key = Buffer.from(String(raw || ''), 'base64url')
  if (key.length !== 32) {
    throw new Error('DATA_KEY должен быть 32 байта в base64url')
  }
  return key
}

export function seal(key, plain) {
  if (plain == null || plain === '') return null
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64url')
}

export function unseal(key, packed) {
  if (!packed) return null
  const buf = Buffer.from(packed, 'base64url')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

// 18 байт → 24 символа из алфавита Telegram start-параметра, лимит 64.
export function newToken() {
  return randomBytes(18).toString('base64url')
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/
