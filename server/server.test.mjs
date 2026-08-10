// `npm run test:server` — memakai database sementara, tidak menyentuh data asli.
// Yang dijaga: kata sandi tidak pernah disimpan polos, token tidak bisa dipalsukan,
// progres basi tidak menimpa yang baru, dan skor perang tidak bisa ditumpuk.
import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.DB_PATH = join(mkdtempSync(join(tmpdir(), 'numquest-')), 'test.db')
process.env.AUTH_SECRET = 'rahasia-uji'
delete process.env.AI_KEY

const { server } = await import('./index.js')
const { makeToken, readToken, hashPassword, verifyPassword } = await import('./auth.js')

await new Promise((r) => server.listen(0, r))
const base = `http://localhost:${server.address().port}`

const call = async (method, path, { token, body } = {}) => {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: res.status, data: await res.json() }
}

// 1. Kata sandi: di-hash, terverifikasi, dan salt-nya berbeda tiap kali
const h1 = hashPassword('kataSandiku123')
assert.ok(!h1.includes('kataSandiku123'), 'kata sandi tidak boleh tersimpan polos')
assert.notEqual(h1, hashPassword('kataSandiku123'), 'salt harus acak')
assert.equal(verifyPassword('kataSandiku123', h1), true)
assert.equal(verifyPassword('kataSandiKU123', h1), false)

// 2. Token: sah, kedaluwarsa ditolak, tanda tangan palsu ditolak
assert.equal(readToken(makeToken(7)), 7)
assert.equal(readToken(makeToken(7, -1)), null, 'token kedaluwarsa harus ditolak')
assert.equal(readToken('7.9999999999999.tandatanganpalsu'), null, 'tanda tangan palsu harus ditolak')
assert.equal(readToken('bukan-token'), null)

// 3. Pendaftaran: validasi masukan
assert.equal((await call('POST', '/api/auth/register', { body: { email: 'bukan-email', password: 'panjangsekali', handle: 'andi' } })).status, 400)
assert.equal((await call('POST', '/api/auth/register', { body: { email: 'a@b.co', password: 'pendek', handle: 'andi' } })).status, 400)
assert.equal((await call('POST', '/api/auth/register', { body: { email: 'a@b.co', password: 'panjangsekali', handle: 'a' } })).status, 400)

const andi = (await call('POST', '/api/auth/register', { body: { email: 'andi@contoh.id', password: 'kataSandiku123', handle: 'andi' } })).data
const budi = (await call('POST', '/api/auth/register', { body: { email: 'budi@contoh.id', password: 'kataSandiku123', handle: 'budi' } })).data
assert.ok(andi.token && andi.user.id)
assert.equal((await call('POST', '/api/auth/register', { body: { email: 'andi@contoh.id', password: 'kataSandiku123', handle: 'lain' } })).status, 400, 'email ganda ditolak')

// 4. Masuk: pesan galat sama untuk email salah dan sandi salah (tidak membocorkan)
const salahSandi = await call('POST', '/api/auth/login', { body: { email: 'andi@contoh.id', password: 'salahsekali' } })
const tidakAda = await call('POST', '/api/auth/login', { body: { email: 'hantu@contoh.id', password: 'salahsekali' } })
assert.equal(salahSandi.status, 401)
assert.equal(salahSandi.data.error, tidakAda.data.error, 'pesan galat tidak boleh membedakan email ada / tidak')

// 5. Tanpa token = ditolak
assert.equal((await call('GET', '/api/state')).status, 401)
assert.equal((await call('GET', '/api/state', { token: 'palsu' })).status, 401)

// 6. Sinkronisasi progres: yang lebih maju menang, yang basi tidak menimpa
await call('PUT', '/api/state', { token: andi.token, body: { state: { xp: 500, level: 'easy' } } })
const basi = await call('PUT', '/api/state', { token: andi.token, body: { state: { xp: 100, level: 'easy' } } })
assert.equal(basi.data.stale, true, 'kiriman basi harus ditandai')
assert.equal(basi.data.state.xp, 500, 'progres tidak boleh mundur')
assert.equal((await call('GET', '/api/state', { token: andi.token })).data.state.xp, 500)
assert.equal((await call('PUT', '/api/state', { token: andi.token, body: { state: 'bukan-objek' } })).status, 400)

// 7. Liga: peringkat dari XP pekan berjalan
await call('PUT', '/api/state', { token: budi.token, body: { state: { xp: 900, level: 'easy' } } })
const liga = (await call('GET', '/api/league', { token: andi.token })).data
assert.equal(liga.members.length, 2)
assert.equal(liga.members[0].handle, 'budi', 'XP terbesar di peringkat 1')
assert.equal(liga.members.find((m) => m.me).handle, 'andi')

// 8. Klan: buat, gabung, batas, dan obrolan
const klan = (await call('POST', '/api/clans', { token: andi.token, body: { name: 'Penjaga Angka', motto: 'pelan tapi jalan' } })).data
assert.ok(klan.clanId)
assert.equal((await call('POST', '/api/clans', { token: andi.token, body: { name: 'Klan Kedua' } })).status, 400, 'tidak boleh punya dua klan')
assert.equal((await call('POST', '/api/clans', { token: budi.token, body: { name: 'ab' } })).status, 400, 'nama terlalu pendek')
await call('POST', '/api/clans/join', { token: budi.token, body: { clanId: klan.clanId } })
assert.equal((await call('POST', '/api/clan/challenge', { token: budi.token, body: { text: 'x', goal: 100 } })).status, 403, 'hanya ketua yang boleh')
await call('POST', '/api/clan/chat', { token: budi.token, body: { body: 'halo semua' } })
const punyaAndi = (await call('GET', '/api/clan', { token: andi.token })).data
assert.equal(punyaAndi.clan.members.length, 2)
assert.equal(punyaAndi.chat.at(-1).body, 'halo semua')
assert.equal((await call('POST', '/api/clan/chat', { token: andi.token, body: { body: '   ' } })).status, 400, 'pesan kosong ditolak')

// 9. Perang klan: butuh lawan, skor terbaik yang dipakai, tidak bisa ditumpuk
assert.equal(punyaAndi.war, null, 'belum ada klan lain untuk dilawan')
const cita = (await call('POST', '/api/auth/register', { body: { email: 'cita@contoh.id', password: 'kataSandiku123', handle: 'cita' } })).data
await call('POST', '/api/clans', { token: cita.token, body: { name: 'Pendekar Hitung' } })
const perang = (await call('GET', '/api/clan', { token: andi.token })).data.war
assert.ok(perang, 'lawan harus terpasang otomatis')
assert.equal(perang.us.stars, 0)

assert.equal((await call('POST', '/api/war/session', { token: andi.token, body: { stars: 2 } })).data.war.us.stars, 2)
const turun = await call('POST', '/api/war/session', { token: andi.token, body: { stars: 1 } })
assert.equal(turun.data.counted, false, 'skor lebih rendah tidak menggantikan')
assert.equal(turun.data.war.us.stars, 2, 'bintang klan tidak boleh berkurang')
const naik = await call('POST', '/api/war/session', { token: andi.token, body: { stars: 3 } })
assert.equal(naik.data.war.us.stars, 3, 'hanya selisihnya yang ditambahkan, bukan ditumpuk')
assert.equal((await call('POST', '/api/war/session', { token: andi.token, body: { stars: 99 } })).data.war.us.stars, 3, 'bintang dibatasi 3')

// 10. Keluar klan: klan kosong ikut hilang
await call('POST', '/api/clans/leave', { token: cita.token })
assert.equal((await call('GET', '/api/clan', { token: cita.token })).data.clan, null)
assert.ok(!(await call('GET', '/api/clans', { token: andi.token })).data.clans.some((c) => c.name === 'Pendekar Hitung'), 'klan kosong dihapus')

// 11. Peta dunia terbuka tanpa token
const dunia = (await call('GET', '/api/world')).data
assert.equal(dunia.pemain, 3)
assert.ok(dunia.xpTotal >= 1400)

// 12. Tanpa AI_KEY semuanya tetap jalan lewat mesin lokal
const pelatih = (await call('GET', '/api/coach', { token: andi.token })).data
assert.equal(pelatih.source, 'lokal')
assert.ok(pelatih.focus.length > 0 && pelatih.message)
const tugas = (await call('GET', '/api/quests', { token: andi.token })).data.quests
assert.equal(tugas.length, 3)
assert.equal(new Set(tugas.map((q) => q.kind)).size, 3, 'tiga tugas harus berbeda jenis')
assert.ok(tugas.every((q) => q.target > 0 && q.title))
const tantangan = (await call('GET', '/api/challenge', { token: andi.token })).data
assert.ok(tantangan.title && tantangan.domain && tantangan.variantBias)

assert.equal((await call('GET', '/api/tidak-ada', { token: andi.token })).status, 404)

server.close()
console.log('✓ auth, token, sinkronisasi progres, liga, klan, obrolan, perang & cadangan AI — semua lolos')
