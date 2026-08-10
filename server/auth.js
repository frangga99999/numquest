// ponytail: scrypt + token bertanda HMAC dari node:crypto. Tidak ada dependensi auth.
// Pindah ke penyedia identitas kalau sudah butuh SSO / reset kata sandi lewat email.
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from 'node:crypto'

const SECRET = process.env.AUTH_SECRET || 'numquest-dev-secret-ganti-di-produksi'
const DAY = 86400_000

export const hashPassword = (pw) => {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`
}

export function verifyPassword(pw, stored) {
  const [salt, key] = String(stored).split(':')
  if (!salt || !key) return false
  const a = Buffer.from(key, 'hex')
  const b = scryptSync(pw, salt, 64)
  return a.length === b.length && timingSafeEqual(a, b)
}

const sign = (body) => createHmac('sha256', SECRET).update(body).digest('base64url')

export const makeToken = (userId, days = 90) => {
  const body = `${userId}.${Date.now() + days * DAY}`
  return `${body}.${sign(body)}`
}

export function readToken(token) {
  if (typeof token !== 'string') return null
  const i = token.lastIndexOf('.')
  if (i < 0) return null
  const body = token.slice(0, i)
  const sig = token.slice(i + 1)
  const expect = sign(body)
  if (sig.length !== expect.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null
  const [id, exp] = body.split('.')
  if (!id || Number(exp) < Date.now()) return null
  return Number(id)
}

// Validasi di batas kepercayaan — jangan pernah dilewati walau formnya sudah mengecek.
export function validateSignup({ email, password, handle }) {
  if (typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return 'Email tidak valid'
  if (typeof password !== 'string' || password.length < 8) return 'Kata sandi minimal 8 karakter'
  if (typeof handle !== 'string' || !/^[a-zA-Z0-9_]{3,16}$/.test(handle)) return 'Nama pemain 3–16 huruf/angka/garis bawah'
  return null
}
