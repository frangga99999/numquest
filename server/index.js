// ponytail: router mungil di atas node:http — tidak ada framework. ~20 rute.
// Ganti ke Fastify kalau nanti butuh plugin, validasi skema, atau WebSocket.
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import db, { weekKey, rollWeek } from './db.js'
import { hashPassword, verifyPassword, makeToken, readToken, validateSignup } from './auth.js'
import * as ai from './ai.js'
import { today } from '../src/engine.js'

const PORT = Number(process.env.PORT || 8787)
const routes = []
const on = (method, path, handler) => routes.push({ method, path: path.split('/'), handler })

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status } }
const bad = (msg) => { throw new HttpError(400, msg) }

const userById = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id)
const publicUser = (u) => ({ id: u.id, handle: u.handle, email: u.email, xp: u.xp, weekXp: u.week_xp, level: u.level, clanId: u.clan_id, role: u.role })
// Selalu isi bidang yang dipakai mesin belajar — klien versi lama / state kosong
// tidak boleh membuat rute AI dan liga meledak.
const DEFAULTS = { level: 'easy', goalMin: 5, xp: 0, streak: 0, skills: {}, srs: {}, days: {}, levelDays: {} }
const parseState = (u) => { try { return { ...DEFAULTS, ...JSON.parse(u.state) } } catch { return { ...DEFAULTS } } }

// --------------------------------- Auth -------------------------------------
on('POST', '/api/auth/register', ({ body }) => {
  const err = validateSignup(body)
  if (err) bad(err)
  const email = body.email.trim().toLowerCase()
  if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) bad('Email sudah terdaftar')
  if (db.prepare('SELECT 1 FROM users WHERE handle = ?').get(body.handle)) bad('Nama pemain sudah dipakai')
  const info = db.prepare('INSERT INTO users (email, pass, handle, state, week, updated) VALUES (?,?,?,?,?,?)')
    .run(email, hashPassword(body.password), body.handle, JSON.stringify(body.state || {}), weekKey(), Date.now())
  const u = userById(Number(info.lastInsertRowid))
  return { token: makeToken(u.id), user: publicUser(u), state: parseState(u) }
})

on('POST', '/api/auth/login', ({ body }) => {
  if (typeof body.email !== 'string' || typeof body.password !== 'string') bad('Email dan kata sandi wajib diisi')
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(body.email.trim().toLowerCase())
  // pesan yang sama untuk email tidak ada / sandi salah — jangan bocorkan mana yang keliru
  if (!u || !verifyPassword(body.password, u.pass)) throw new HttpError(401, 'Email atau kata sandi tidak cocok')
  return { token: makeToken(u.id), user: publicUser(rollWeek(u)), state: parseState(u) }
})

// --------------------------------- Progres ----------------------------------
on('GET', '/api/state', ({ user }) => ({ user: publicUser(user), state: parseState(user) }))

// "progres pengguna selalu menang": kalau XP yang dikirim lebih kecil dari yang
// tersimpan, ini perangkat basi — kembalikan yang tersimpan, jangan timpa.
on('PUT', '/api/state', ({ user, body }) => {
  const incoming = body?.state
  if (!incoming || typeof incoming !== 'object') bad('state wajib berupa objek')
  const xp = Number(incoming.xp) || 0
  if (xp < user.xp) return { user: publicUser(user), state: parseState(user), stale: true }
  const gained = xp - user.xp
  db.prepare('UPDATE users SET state=?, xp=?, week_xp=week_xp+?, level=?, updated=? WHERE id=?')
    .run(JSON.stringify(incoming), xp, gained, String(incoming.level || 'easy'), Date.now(), user.id)
  return { user: publicUser(userById(user.id)), state: incoming }
})

// --------------------------------- AI ---------------------------------------
on('GET', '/api/coach', async ({ user }) => ai.coach(parseState(user)))
on('GET', '/api/quests', async ({ user }) => ({ quests: await ai.quests(parseState(user), today()) }))
on('GET', '/api/challenge', async ({ user }) => ai.challenge(parseState(user), today()))

on('POST', '/api/problem/flavor', async ({ user, body }) => ({ variants: await ai.flavorProblems(Array.isArray(body.problems) ? body.problems.slice(0, 20) : [], parseState(user)) }))
on('POST', '/api/problem/explain', async ({ user, body }) => {
  const p = body.problem || {}
  if (typeof p.text !== 'string') bad('problem.text wajib diisi')
  return ai.explainSimple(p, parseState(user))
})

// --------------------------------- Liga -------------------------------------
// Liga dihitung saat diminta dari XP pekan berjalan — tidak ada tabel terpisah,
// tidak ada cron. 30 pemain per grup, dipisah per tingkat.
const TIERS = ['Perisai Perunggu', 'Pedang Perak', 'Mahkota Emas', 'Benteng Berlian', 'Singgasana Obsidian']

on('GET', '/api/league', ({ user }) => {
  const u = rollWeek(user)
  const peers = db.prepare('SELECT id, handle, week_xp FROM users WHERE level = ? AND week = ? ORDER BY week_xp DESC, id ASC')
    .all(u.level, weekKey())
  const idx = peers.findIndex((p) => p.id === u.id)
  const group = Math.floor(Math.max(0, idx) / 30)
  const members = peers.slice(group * 30, group * 30 + 30)
  return {
    tier: TIERS[Math.min(TIERS.length - 1, group)],
    week: weekKey(),
    rank: members.findIndex((m) => m.id === u.id) + 1,
    promoteAt: 10,
    demoteAt: Math.max(1, members.length - 5),
    members: members.map((m, i) => ({ rank: i + 1, handle: m.handle, xp: m.week_xp, me: m.id === u.id })),
  }
})

// --------------------------------- Klan -------------------------------------
const clanMembers = (id) => db.prepare('SELECT handle, week_xp, xp, role, level FROM users WHERE clan_id = ? ORDER BY week_xp DESC').all(id)

on('GET', '/api/clans', ({ query }) => ({
  clans: db.prepare(`SELECT c.id, c.name, c.motto, COUNT(u.id) AS members, COALESCE(SUM(u.week_xp),0) AS weekXp
                     FROM clans c LEFT JOIN users u ON u.clan_id = c.id
                     WHERE c.name LIKE ? GROUP BY c.id ORDER BY weekXp DESC LIMIT 30`)
    .all(`%${(query.q || '').slice(0, 40)}%`),
}))

on('POST', '/api/clans', ({ user, body }) => {
  if (user.clan_id) bad('Kamu sudah punya klan')
  const name = String(body.name || '').trim()
  if (name.length < 3 || name.length > 24) bad('Nama klan 3–24 karakter')
  if (db.prepare('SELECT 1 FROM clans WHERE name = ?').get(name)) bad('Nama klan sudah dipakai')
  const info = db.prepare('INSERT INTO clans (name, motto, leader_id, created) VALUES (?,?,?,?)')
    .run(name, String(body.motto || '').slice(0, 120), user.id, Date.now())
  const id = Number(info.lastInsertRowid)
  db.prepare("UPDATE users SET clan_id = ?, role = 'leader' WHERE id = ?").run(id, user.id)
  return { clanId: id }
})

on('POST', '/api/clans/join', ({ user, body }) => {
  if (user.clan_id) bad('Keluar dari klan lama dulu')
  const clan = db.prepare('SELECT * FROM clans WHERE id = ?').get(Number(body.clanId))
  if (!clan) bad('Klan tidak ditemukan')
  const n = db.prepare('SELECT COUNT(*) AS n FROM users WHERE clan_id = ?').get(clan.id).n
  if (n >= 50) bad('Klan sudah penuh (maksimal 50)')
  db.prepare("UPDATE users SET clan_id = ?, role = 'member' WHERE id = ?").run(clan.id, user.id)
  return { ok: true }
})

on('POST', '/api/clans/leave', ({ user }) => {
  if (!user.clan_id) bad('Kamu belum punya klan')
  db.prepare("UPDATE users SET clan_id = NULL, role = 'member' WHERE id = ?").run(user.id)
  // klan tanpa anggota ikut terhapus supaya daftar tidak penuh klan kosong
  if (!db.prepare('SELECT 1 FROM users WHERE clan_id = ?').get(user.clan_id))
    db.prepare('DELETE FROM clans WHERE id = ?').run(user.clan_id)
  return { ok: true }
})

on('GET', '/api/clan', ({ user }) => {
  if (!user.clan_id) return { clan: null }
  const clan = db.prepare('SELECT * FROM clans WHERE id = ?').get(user.clan_id)
  const members = clanMembers(clan.id)
  return {
    clan: { ...clan, members, weekXp: members.reduce((a, m) => a + m.week_xp, 0) },
    chat: db.prepare('SELECT handle, body, at FROM messages WHERE clan_id = ? ORDER BY at DESC LIMIT 50').all(clan.id).reverse(),
    war: currentWar(clan.id),
  }
})

on('POST', '/api/clan/chat', ({ user, body }) => {
  if (!user.clan_id) bad('Kamu belum punya klan')
  const text = String(body.body || '').trim().slice(0, 300)
  if (!text) bad('Pesan kosong')
  db.prepare('INSERT INTO messages (clan_id, handle, body, at) VALUES (?,?,?,?)').run(user.clan_id, user.handle, text, Date.now())
  return { ok: true }
})

on('POST', '/api/clan/challenge', ({ user, body }) => {
  if (user.role !== 'leader') throw new HttpError(403, 'Hanya ketua klan yang bisa menetapkan tantangan')
  db.prepare('UPDATE clans SET challenge=?, goal=? WHERE id=?')
    .run(String(body.text || '').slice(0, 120), Math.max(0, Math.min(1_000_000, Number(body.goal) || 0)), user.clan_id)
  return { ok: true }
})

// --------------------------------- Perang klan ------------------------------
// Lawan dipasangkan otomatis dengan klan lain yang belum berperang pekan ini.
function currentWar(clanId) {
  const week = weekKey()
  let war = db.prepare('SELECT * FROM wars WHERE week = ? AND (clan_a = ? OR clan_b = ?)').get(week, clanId, clanId)
  if (!war) {
    const foe = db.prepare(`SELECT c.id FROM clans c
      WHERE c.id != ? AND c.id NOT IN (SELECT clan_a FROM wars WHERE week = ? UNION SELECT clan_b FROM wars WHERE week = ?)
      ORDER BY (SELECT COUNT(*) FROM users u WHERE u.clan_id = c.id) DESC LIMIT 1`).get(clanId, week, week)
    if (!foe) return null
    const info = db.prepare('INSERT INTO wars (week, clan_a, clan_b) VALUES (?,?,?)').run(week, clanId, foe.id)
    war = db.prepare('SELECT * FROM wars WHERE id = ?').get(Number(info.lastInsertRowid))
  }
  const name = (id) => db.prepare('SELECT name FROM clans WHERE id = ?').get(id)?.name || '—'
  const mine = war.clan_a === clanId
  return {
    id: war.id, week,
    us: { name: name(clanId), stars: mine ? war.stars_a : war.stars_b },
    them: { name: name(mine ? war.clan_b : war.clan_a), stars: mine ? war.stars_b : war.stars_a },
  }
}

on('POST', '/api/war/session', ({ user, body }) => {
  if (!user.clan_id) bad('Kamu belum punya klan')
  const war = currentWar(user.clan_id)
  if (!war) bad('Belum ada perang pekan ini')
  // satu sesi perang per anggota per pekan — skor terbaik yang dipakai
  const stars = Math.max(0, Math.min(3, Math.round(Number(body.stars) || 0)))
  const prev = db.prepare('SELECT stars FROM war_scores WHERE war_id = ? AND user_id = ?').get(war.id, user.id)
  if (prev && prev.stars >= stars) return { war, stars: prev.stars, counted: false }
  const delta = stars - (prev?.stars || 0)
  db.prepare('INSERT INTO war_scores (war_id,user_id,stars) VALUES (?,?,?) ON CONFLICT(war_id,user_id) DO UPDATE SET stars=?')
    .run(war.id, user.id, stars, stars)
  const row = db.prepare('SELECT clan_a FROM wars WHERE id = ?').get(war.id)
  const col = row.clan_a === user.clan_id ? 'stars_a' : 'stars_b'
  db.prepare(`UPDATE wars SET ${col} = ${col} + ? WHERE id = ?`).run(delta, war.id)
  return { war: currentWar(user.clan_id), stars, counted: true }
})

// --------------------------------- Belajar -----------------------------------
// Materi 100% dikarang model (lihat ai.lessons) — termasuk spesifikasi visualnya.
// Tabel `lessons` cuma cache biar halaman tidak menunggu model tiap kali dibuka.
// Cadangan lokal di bawah hanya dipakai kalau model benar-benar tak bisa dihubungi,
// dan klien selalu diberi tahu sumbernya lewat field `source`.
const LESSON_TTL = 7 * 86400e3

const FALLBACK_LESSONS = [
  { id: 'f-add', title: 'Tambah itu Menggabung', domain: 'add',
    content: { hook: 'Tiap kali kamu naruh belanjaan ke keranjang, kamu lagi menjumlah.',
      intro: 'Menjumlah artinya menggabungkan dua kelompok jadi satu. Punya 3, dikasih 2, jadi 5.',
      visual: { kind: 'items', a: 3, b: 2, op: '+', labelA: 'punya', labelB: 'dikasih' },
      steps: [
        { eq: '3', text: 'Mulai dari yang sudah kamu punya: 3.' },
        { eq: '3 + 2', text: 'Gabungkan 2 lagi ke kelompok tadi.' },
        { eq: '= 5', text: 'Hitung semuanya jadi satu: ketemu 5.' }],
      tip: 'Mulai berhitung dari angka yang lebih besar, sisanya tinggal dihitung maju.',
      analogy: 'Kayak nambah saldo e-wallet: yang lama tetap ada, yang baru numpuk di atasnya.',
      why: 'Dipakai tiap kali menghitung total belanja atau menjumlah pemasukan.' } },
  { id: 'f-mul', title: 'Kali itu Nambah Berulang', domain: 'mul',
    content: { hook: 'Beli 3 bungkus yang isinya sama — kamu nggak hitung satu-satu, kan?',
      intro: 'Perkalian itu jalan pintas dari penjumlahan yang berulang. 3 kelompok isi 4 sama dengan 4+4+4.',
      visual: { kind: 'groups', g: 3, p: 4 },
      steps: [
        { eq: '4 + 4 + 4', text: 'Tiga kelompok, tiap kelompok isinya 4.' },
        { eq: '3 x 4', text: 'Daripada ditulis panjang, ringkas jadi 3 kali 4.' },
        { eq: '= 12', text: 'Hasilnya sama persis: 12.' }],
      tip: 'Urutannya boleh dibalik. 3 x 4 dan 4 x 3 hasilnya sama.',
      analogy: 'Kayak beli 3 renteng kopi isi 4 — nggak perlu dihitung satu per satu.',
      why: 'Kepakai buat hitung total harga barang yang jumlahnya banyak.' } },
  { id: 'f-pct', title: 'Persen itu Per Seratus', domain: 'pct',
    content: { hook: 'Tulisan diskon 25% di etalase itu sebenarnya ngomongin 100 petak.',
      intro: 'Persen artinya bagian dari seratus. 25% sama dengan 25 petak dari 100 petak.',
      visual: { kind: 'grid100', filled: 25 },
      steps: [
        { eq: '100 petak', text: 'Bayangkan barangnya dipotong jadi 100 bagian.' },
        { eq: '25 petak', text: 'Diskon 25% artinya 25 bagian itu dipotong dari harga.' },
        { eq: 'bayar 75', text: 'Yang kamu bayar tinggal 75 bagian sisanya.' }],
      tip: 'Cari 10% dulu dengan membagi 10, sisanya tinggal dikali.',
      analogy: 'Kayak bagi pizza jadi 100 iris tipis, lalu ambil 25 iris.',
      why: 'Dipakai buat baca diskon, bunga cicilan, dan potongan pajak.' } },
]

// Materi format lama (visual masih berupa teks, bukan spesifikasi) tidak bisa
// digambar klien — anggap tidak ada supaya otomatis dibuat ulang oleh model.
const validLesson = (l) => l && l.content && l.content.visual && typeof l.content.visual === 'object' && l.content.visual.kind

const lessonPublic = (row) => ({ id: row.id, title: row.title, domain: row.domain, level: row.level, content: JSON.parse(row.content) })
const readLessons = (level) => {
  try {
    return db.prepare('SELECT * FROM lessons WHERE level = ? ORDER BY id').all(level).map(lessonPublic).filter(validLesson)
  } catch { return [] }
}
const lessonsAge = (level) => db.prepare('SELECT MAX(created) AS t FROM lessons WHERE level = ?').get(level)?.t || 0
// node:sqlite tidak punya helper .transaction() seperti better-sqlite3 —
// pakai perintah transaksi apa adanya supaya tukar-materi tetap atomik.
const writeLessons = (level, list) => {
  const del = db.prepare('DELETE FROM lessons WHERE level = ?')
  const ins = db.prepare('INSERT OR REPLACE INTO lessons (id, title, domain, level, content, created) VALUES (?,?,?,?,?,?)')
  const now = Date.now()
  db.exec('BEGIN')
  try {
    del.run(level)
    for (const l of list) ins.run(`${level}:${l.id}`, l.title, l.domain, level, JSON.stringify(l.content), now)
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

on('GET', '/api/lessons', async ({ query }) => {
  const level = ['easy', 'mid', 'adv'].includes(query.level) ? query.level : 'easy'
  const lang = query.lang === 'en' ? 'en' : 'id'
  // Cache dipisah per bahasa: materi Indonesia dan Inggris tidak boleh saling timpa.
  const bucket = `${level}-${lang}`
  const withLevel = (list) => list.map((l) => ({ ...l, level }))
  const cached = readLessons(bucket)
  const fresh = Date.now() - lessonsAge(bucket) < LESSON_TTL
  if (cached.length && fresh && query.refresh !== '1')
    return { lessons: withLevel(cached), source: 'ai', cached: true, aiReady: ai.configured }
  if (!ai.configured)
    return { lessons: withLevel(cached.length ? cached : FALLBACK_LESSONS), source: 'lokal', aiReady: false, warning: 'AI_KEY belum diatur di server' }
  try {
    const list = await ai.lessons(level, lang)
    if (!list.length) throw new Error('Model tidak mengembalikan materi yang sah')
    writeLessons(bucket, list)
    return { lessons: withLevel(readLessons(bucket)), source: 'ai', cached: false, aiReady: true }
  } catch (e) {
    const warning = String(e.message).slice(0, 180)
    if (cached.length) return { lessons: withLevel(cached), source: 'ai', cached: true, aiReady: true, warning }
    return { lessons: withLevel(FALLBACK_LESSONS), source: 'lokal', aiReady: true, warning }
  }
})

// Chat materi — galat sengaja dilempar apa adanya supaya putusnya sambungan ke
// model kelihatan di layar, bukan disamarkan jadi kalimat balasan.
on('POST', '/api/learn/chat', async ({ user, body }) => {
  const msg = String(body.message || '').trim().slice(0, 500)
  if (!msg) bad('Pesan kosong')
  if (!ai.configured) throw new HttpError(503, 'AI_KEY belum diatur di server')
  const topic = String(body.topic || '').slice(0, 200)
  const history = (Array.isArray(body.history) ? body.history : []).slice(-4)
    .map((h) => ({ role: h?.role === 'ai' ? 'ai' : 'user', text: String(h?.text || '').slice(0, 300) }))
  const state = user ? parseState(user) : { ...DEFAULTS }
  const lang = body.lang === 'en' ? 'en' : 'id'
  try {
    const out = await ai.learnChat(state, msg, topic, history, lang)
    return { ...out, source: 'ai' }
  } catch (e) {
    throw new HttpError(502, `AI tidak merespons: ${String(e.message).slice(0, 160)}`)
  }
})

// --------------------------------- Peta dunia -------------------------------
on('GET', '/api/world', () => {
  const u = db.prepare('SELECT COUNT(*) AS pemain, COALESCE(SUM(xp),0) AS xp FROM users').get()
  return {
    pemain: u.pemain,
    xpTotal: u.xp,
    // 1 XP ≈ 1 jawaban benar; cukup untuk angka "berapa soal dikerjakan bersama"
    soalTotal: Math.round(u.xp / 10),
    klan: db.prepare('SELECT COUNT(*) AS n FROM clans').get().n,
    teratas: db.prepare(`SELECT c.name, COALESCE(SUM(u.week_xp),0) AS xp FROM clans c
                         LEFT JOIN users u ON u.clan_id = c.id GROUP BY c.id ORDER BY xp DESC LIMIT 5`).all(),
  }
})

// --------------------------------- Server -----------------------------------
const send = (res, status, data) => {
  const payload = JSON.stringify(data)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  })
  res.end(payload)
}

const readBody = (req) => new Promise((resolve, reject) => {
  let raw = ''
  req.on('data', (c) => {
    raw += c
    if (raw.length > 512_000) { reject(new HttpError(413, 'Data terlalu besar')); req.destroy() }
  })
  req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}) } catch { reject(new HttpError(400, 'JSON tidak valid')) } })
  req.on('error', reject)
})

const match = (route, parts) => route.path.length === parts.length && route.path.every((p, i) => p === parts[i])

export const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {})
  const url = new URL(req.url, 'http://localhost')
  const parts = url.pathname.split('/')
  const route = routes.find((r) => r.method === req.method && match(r, parts))
  if (!route) return send(res, 404, { error: 'Rute tidak ditemukan' })

  try {
    // Materi & chat panduan sengaja terbuka: kunci AI ada di server, isinya
    // tidak menyentuh data pribadi, dan halaman panduan harus tetap 100%
    // digerakkan AI walau pengguna belum bikin akun.
    const OPEN_PATHS = new Set(['/api/world', '/api/lessons', '/api/learn/chat'])
    const open = url.pathname.startsWith('/api/auth/') || OPEN_PATHS.has(url.pathname)
    let user = null
    if (!open) {
      const id = readToken((req.headers.authorization || '').replace(/^Bearer /, ''))
      user = id && userById(id)
      if (!user) throw new HttpError(401, 'Sesi berakhir, masuk lagi ya')
    }
    const body = req.method === 'GET' ? {} : await readBody(req)
    send(res, 200, await route.handler({ user, body, query: Object.fromEntries(url.searchParams) }))
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(req.method, url.pathname, e)
    send(res, e.status || 500, { error: e.status ? e.message : 'Ada gangguan di server' })
  }
})

if (process.argv[1] === fileURLToPath(import.meta.url))
  server.listen(PORT, () => console.log(`NumQuest API di http://localhost:${PORT} (AI: ${ai.configured ? 'aktif' : 'nonaktif'})`))
