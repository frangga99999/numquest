// ponytail: penyaji berkas statis seukuran kebutuhan app ini — tanpa dependensi,
// tanpa proses kedua. Frontend hasil `vite build` dan API dilayani proses yang sama.
// Gzip disiapkan sekali lalu disimpan di memori; berkas ber-hash di /assets
// boleh di-cache selamanya, index.html tidak boleh.

import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

// Tipe yang layak digzip. Audio/gambar sudah terkompresi — jangan dibuang CPU-nya.
const COMPRESSIBLE = /^(text\/|application\/(json|javascript|manifest\+json)|image\/svg)/

const cache = new Map() // absolute path -> { mtimeMs, size, raw, gz, type }
const MAX_CACHE = 64

const typeOf = (file) => MIME[path.extname(file).toLowerCase()] || 'application/octet-stream'

// Anti-traversal: hanya boleh menyentuh berkas di dalam root.
function safeResolve(root, urlPath) {
  let p
  try { p = decodeURIComponent(urlPath) } catch { return null }
  if (p.includes('\0')) return null
  const full = path.resolve(root, '.' + path.posix.normalize(p))
  return full === root || full.startsWith(root + path.sep) ? full : null
}

function load(file) {
  let st
  try { st = fs.statSync(file) } catch { return null }
  if (!st.isFile()) return null
  const hit = cache.get(file)
  if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return hit

  const raw = fs.readFileSync(file)
  const type = typeOf(file)
  const entry = {
    mtimeMs: st.mtimeMs,
    size: st.size,
    raw,
    // Di bawah ~1 KB, overhead gzip tidak sebanding.
    gz: raw.length > 1024 && COMPRESSIBLE.test(type) ? zlib.gzipSync(raw, { level: 6 }) : null,
    type,
  }
  if (cache.size >= MAX_CACHE) cache.clear()
  cache.set(file, entry)
  return entry
}

/**
 * @param {string} dir  direktori hasil build (dist)
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, urlPath: string) => boolean}
 *   Mengembalikan true kalau permintaan sudah dijawab.
 */
export function createStatic(dir, { index = 'index.html' } = {}) {
  const root = path.resolve(dir)

  return function serveStatic(req, res, urlPath) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false
    if (!fs.existsSync(root)) return false

    let file = safeResolve(root, urlPath)
    if (!file) {
      res.writeHead(403, { 'Content-Type': 'text/plain' })
      res.end('Terlarang')
      return true
    }

    // Rute aplikasi tidak memakai URL (semuanya state tab), jadi lintasan apa pun
    // yang bukan berkas jatuh ke index.html.
    let entry = load(file)
    if (!entry && !path.extname(urlPath)) {
      file = path.join(root, index)
      entry = load(file)
    }
    if (!entry) return false // biar pemanggil yang memutuskan 404 JSON

    const etag = `W/"${entry.size.toString(16)}-${Math.round(entry.mtimeMs).toString(16)}"`
    const isHashed = urlPath.startsWith('/assets/')
    const headers = {
      'Content-Type': entry.type,
      'ETag': etag,
      'Cache-Control': isHashed ? 'public, max-age=31536000, immutable' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    }

    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, headers)
      res.end()
      return true
    }

    const useGz = entry.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '')
    const body = useGz ? entry.gz : entry.raw
    headers['Content-Length'] = body.length
    if (useGz) headers['Content-Encoding'] = 'gzip'

    res.writeHead(200, headers)
    res.end(req.method === 'HEAD' ? undefined : body)
    return true
  }
}
