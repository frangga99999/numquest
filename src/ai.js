// Rencana harian: pelatih, 3 tugas, dan 1 tantangan bertema.
// Server yang memanggil model (kunci API ada di sana). Kalau server tidak ada,
// tidak login, atau modelnya gagal — semuanya jatuh ke generator lokal dan
// aplikasi tetap berjalan penuh.

import { dayKey, today } from './engine.js'
import { localCoach, DIAGNOSTIC, placeLevel } from './coach.js'
import { localQuests, localChallenge } from './quests.js'
import { api, loggedIn } from './api.js'

const localPlan = (g) => ({
  day: dayKey(),
  coach: localCoach(g),
  quests: localQuests(g, today()),
  challenge: localChallenge(g, today()),
  source: 'lokal',
})

export async function dailyPlan(g) {
  if (g.plan?.day === dayKey()) return g.plan
  const base = localPlan(g)
  if (!loggedIn()) return base
  try {
    const [coach, quests, challenge] = await Promise.all([api.coach(), api.quests(), api.challenge()])
    return {
      day: dayKey(),
      coach: { ...base.coach, ...coach },
      quests: quests.quests?.length === 3 ? quests.quests : base.quests,
      challenge: { ...base.challenge, ...challenge },
      source: coach.source === 'ai' ? 'ai' : 'lokal',
    }
  } catch {
    return base
  }
}

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])

// Bungkus tiap soal jadi kalimat cerita yang beda-beda lewat DeepSeek — angka
// dan jawaban tidak pernah disentuh, cuma teksnya. Gagal/timeout/belum masuk →
// diam-diam balik ke teks asli, sesi tetap bisa mulai tanpa nunggu lama.
// `kind` dikirim agar server bisa kasih prompt lebih kreatif buat challenge.
export async function flavorSession(problems, g, kind = 'normal') {
  if (!problems.length) return problems
  // Challenge selalu coba AI dulu, meski belum login — lebih seru.
  if (!loggedIn() && kind !== 'challenge') return problems
  try {
    const { variants } = await withTimeout(
      api.flavorProblems(problems.map((p) => ({ key: p.key, text: p.text, kind }))), 7000,
    )
    if (!variants) return problems
    return problems.map((p) => (variants[p.key] ? { ...p, text: variants[p.key] } : p))
  } catch {
    return problems
  }
}

// Generate soal challenge dari AI — server yang ngeramu angka & jawaban.
// Challenge selalu coba AI — lebih seru, meski belum login.
// Kalau gagal/timeout, kembalikan null (pemanggil jatuh ke buildSession).
export async function challengeProblems(count, level, domain) {
  try {
    const { problems } = await withTimeout(
      api.challengeProblems({ count, level, domain }), 12000,
    )
    return problems || null
  } catch {
    return null
  }
}

// Penjelasan dadakan buat lifeline "Tanya AI" dan tips otomatis saat salah jawab.
// Return { tips: [{title, steps}] } atau null kalau gagal.
export async function explainProblem(problem) {
  if (!loggedIn()) return null
  try {
    const { tips, explanation } = await withTimeout(
      api.explainProblem({ text: problem.text, answer: problem.answer }), 8000,
    )
    if (tips?.length === 2) return { tips }
    // fallback: kalau server balikin format lama (explanation string)
    if (explanation) return { tips: [{ title: 'Cara cepat', steps: [explanation] }] }
    return null
  } catch {
    return null
  }
}

export { DIAGNOSTIC, placeLevel }

// ── Ultimate Mode — 80% visual/spasial ────────────────────────────────────
// Generator lokal untuk Ultimate Mode. Fokus: lateral thinking, logika
// pemrograman, creative thinking, problem solving.
// Komposisi: 80% soal visual/spasial, 20% logic murni.
// Dibuat per level (easy/mid/adv) supaya eskalasi tetap terasa.

const LOCAL_ULTIMATE = {
  easy: [
    // ── Visual (80%) — bahasa anak SD, analogi gampang ─────────────────────
    () => {
      const n = 2 + Math.floor(Math.random() * 4)
      const terms = []
      for (let i = 0; i < 5; i++) terms.push(n + i * 3)
      return { text: `Koin di game: level 1=${terms[0]}, level 2=${terms[1]}, level 3=${terms[2]}, level 4=${terms[3]}. Tiap naik level nambah berapa koin?`, answer: 3, domain: 'logic', icon: 'ph:shapes-fill' }
    },
    () => {
      const start = Math.floor(Math.random() * 4)
      const steps = 1 + Math.floor(Math.random() * 3)
      const end = (start + steps) % 4
      const dir = ['Utara', 'Timur', 'Selatan', 'Barat']
      return { text: `HP kamu ngadep ${dir[start]}. Diputer ke kanan ${steps} kali. Sekarang ngadep mana? (1=Utara,2=Timur,3=Selatan,4=Barat)`, answer: end + 1, domain: 'logic', icon: 'ph:compass-fill' }
    },
    () => {
      const mul = 2 + Math.floor(Math.random() * 4)
      return { text: `Numpuk kardus: tumpukan 1 isinya ${mul}, tumpukan 3 isinya ${mul * 3}. Tiap tumpukan nambah ${mul}. Tumpukan 2 isinya berapa?`, answer: mul * 2, domain: 'logic', icon: 'ph:grid-nine-fill' }
    },
    () => {
      return { text: 'Ngantre es krim: Ana di depan Budi. Citra di tengah-tengah Ana & Budi. Dodi paling belakang. Ana di urutan ke berapa? (1=paling depan)', answer: 1, domain: 'logic', icon: 'ph:users-fill' }
    },
    () => {
      const a = 2 + Math.floor(Math.random() * 5)
      const b = a + 1 + Math.floor(Math.random() * 3)
      return { text: `Di kantin: ada ${a + b} buah apel & jeruk. Apel = ${a} buah. Jeruk ada berapa?`, answer: b, domain: 'logic', icon: 'ph:sparkle-fill' }
    },
    () => {
      const n = 3 + Math.floor(Math.random() * 5)
      return { text: `Kertas kotak-kotak ${n} × ${n} baris. Semua kotaknya diitung, totalnya berapa?`, answer: n * n, domain: 'mul', icon: 'ph:cube-fill' }
    },
    () => {
      const n = 2 + Math.floor(Math.random() * 4)
      return { text: `Kode rahasia: A=${n}, B=${n * 2}, C=${n * 3}. Kalo kamu tulis "BC" artinya B + C. Hasilnya berapa?`, answer: n * 5, domain: 'logic', icon: 'ph:translate-fill' }
    },
    // ── Logic (20%) ────────────────────────────────────────────────────────
    () => {
      const x = 1 + Math.floor(Math.random() * 4)
      return { text: `HP karakter kamu ${x}%. Terus kamu dapet bonus +3%, abis itu HP-nya dikali 2. HP kamu sekarang berapa?`, answer: (x + 3) * 2, domain: 'logic', icon: 'ph:terminal-fill' }
    },
    () => {
      const words = [{ w: 'DUA', n: 3 }, { w: 'LIMA', n: 4 }, { w: 'TUJUH', n: 5 }]
      const p = words[Math.floor(Math.random() * words.length)]
      return { text: `Tebak-tebakan: angka 1 tuh 3, angka 2 tuh 3, angka 3 tuh 5. Kok gitu? Soalnya diitung HURUFnya! Nah, kata "${p.w}" = berapa?`, answer: p.n, domain: 'logic', icon: 'ph:brain-fill' }
    },
    () => {
      const n = 2 + Math.floor(Math.random() * 4)
      let val = n
      for (let i = 0; i < 3; i++) val = val % 2 === 0 ? val / 2 : val * 3 + 1
      return { text: `Botol ajaib isinya ${n}ml. Kalo isinya genap: minum setengahnya. Kalo ganjil: tambahin 2× lipat + 1. Lakuin 3 kali ya. Terakhir isinya berapa?`, answer: val, domain: 'logic', icon: 'ph:git-branch-fill' }
    },
  ],

  mid: [
    () => {
      const n = 2 + Math.floor(Math.random() * 3)
      const terms = [n]
      for (let i = 1; i < 5; i++) terms.push(terms[i - 1] * 2 + 1)
      return { text: `Misi harian: misi 1=${terms[0]} XP, 2=${terms[1]}, 3=${terms[2]}, 4=${terms[3]}. Caranya: XP sebelum × 2 + 1. Misi ke-5 dapet berapa XP?`, answer: terms[4], domain: 'logic', icon: 'ph:shapes-fill' }
    },
    () => {
      const ops = [
        { text: 'Dadu ular tangga: sisi atas=1, depan=3, kanan=5. Guling ke KANAN 1 kali. Sisi atas sekarang angka berapa?', answer: 5 },
        { text: 'Dadu: atas=6, depan=2, kanan=4. Guling ke BAWAH 1 kali. Sisi depan sekarang angka berapa?', answer: 6 },
        { text: 'Dadu: atas=3, depan=1, kanan=5. Guling ke KANAN 2 kali. Sisi kanan sekarang angka berapa?', answer: 1 },
      ]
      const p = ops[Math.floor(Math.random() * ops.length)]
      return { ...p, domain: 'logic', icon: 'ph:compass-fill' }
    },
    () => {
      const r = 2 + Math.floor(Math.random() * 4)
      return { text: `Menu kantin: paket 1 harganya ${r}rb, ${r * 2}rb, ${r * 3}rb. Paket 2: ${r * 2}rb, ${r * 4}rb, ${r * 6}rb. Paket 3: ${r * 3}rb, ?, ${r * 9}rb. Polanya nambah ${r}rb. Yang "?" berapa?`, answer: r * 6, domain: 'logic', icon: 'ph:grid-nine-fill' }
    },
    () => {
      return { text: '5 anak duduk melingkar main kartu: A di tengah B & C. D tepat berseberangan sama B. E di kiri C. A duduknya di posisi berapa? (1-5, searah jarum jam, B di 1)', answer: 2, domain: 'logic', icon: 'ph:users-fill' }
    },
    () => {
      const a = 3 + Math.floor(Math.random() * 5)
      const b = a + 2
      return { text: `Beli jajan: 🍩 + 🥤 = ${a + b}rb. Kalo 🍩 × 🥤 = ${a * b}. 🍩 lebih murah dari 🥤. Selisih harga 🥤 − 🍩 berapa?`, answer: b - a, domain: 'logic', icon: 'ph:sparkle-fill' }
    },
    () => {
      const l = 3 + Math.floor(Math.random() * 5)
      const w = 2 + Math.floor(Math.random() * 4)
      return { text: `Kasur ${l} × ${w} meter. Diputer 90°, luasnya sama aja kan? Luasnya berapa emang?`, answer: l * w, domain: 'mul', icon: 'ph:cube-fill' }
    },
    () => {
      return { text: 'Kode game: A=1, B=2, C=3, D=4. Kalo CAB = 3+1+2 = 6. Nah, kalo BAD = 2+1+4 = berapa?', answer: 7, domain: 'logic', icon: 'ph:translate-fill' }
    },
    () => {
      return { text: 'Dua kantong: kiri isi 8rb, kanan 13rb. Semua isi kanan dipindahin ke kiri. Terus kiri ngasih 5rb ke kanan. Kantong kiri sekarang isinya berapa?', answer: 13, domain: 'logic', icon: 'ph:terminal-fill' }
    },
    () => {
      const w = ['SATU', 'DUA', 'ENAM', 'TUJUH'][Math.floor(Math.random() * 4)]
      return { text: `Tebak-tebakan: 1=3, 2=3, 3=5, 4=3, 5=4. Rahasianya: itu jumlah HURUF! Nah, "${w}" ada berapa huruf?`, answer: w.length, domain: 'logic', icon: 'ph:brain-fill' }
    },
    () => {
      const s = 3 + Math.floor(Math.random() * 8)
      let v = s
      for (let i = 0; i < 4; i++) v = v % 2 === 0 ? v / 2 : v + 1
      return { text: `Nilai ujian: ${s}. Diulang 4 kali: kalo genap → dibagi 2. Kalo ganjil → ditambah 1. Nilai terakhir berapa?`, answer: v, domain: 'logic', icon: 'ph:git-branch-fill' }
    },
  ],

  adv: [
    () => {
      const terms = [1, 1]
      for (let i = 2; i < 6; i++) terms.push(terms[i - 1] + terms[i - 2])
      return { text: `Level dungeon: 1, 1, 2, 3, 5, ?. Caranya: tiap level = jumlah 2 level sebelumnya. Level ke-6 berapa?`, answer: terms[5], domain: 'logic', icon: 'ph:shapes-fill' }
    },
    () => {
      return { text: 'Kubus rubik: depan=1, atas=2, kanan=3, kiri=4, bawah=5, belakang=6. Putar ke KANAN, lalu ATAS, lalu KANAN lagi. Sisi DEPAN sekarang angka berapa?', answer: 5, domain: 'logic', icon: 'ph:compass-fill' }
    },
    () => {
      return { text: 'Kotak angka ajaib 3×3: semua baris & kolom jumlahnya 15. Tengah=5, kiri atas=2. Kanan bawah isinya angka berapa?', answer: 8, domain: 'logic', icon: 'ph:grid-nine-fill' }
    },
    () => {
      return { text: '6 anak di meja 2 baris × 3 kolom. Ali di depan Budi. Citra di kanan Ali. Dodi di belakang Citra. Eka di kiri Budi. Fani di kanan Eka. Budi di posisi berapa? (1-6)', answer: 5, domain: 'logic', icon: 'ph:users-fill' }
    },
    () => {
      const x = 2 + Math.floor(Math.random() * 6)
      const y = x + 1 + Math.floor(Math.random() * 4)
      const z = y + 1 + Math.floor(Math.random() * 3)
      return { text: `Kode rahasia: ◆◇ + ◇◆ = ${x * 10 + y + y * 10 + x}. ◆=${y}, ◇=${x}. Kalo ◆ × ◇ + ? = ${y * x + z}. Yang "?" berapa?`, answer: z, domain: 'logic', icon: 'ph:sparkle-fill' }
    },
    () => {
      const r = 3 + Math.floor(Math.random() * 4)
      const area = Math.round(Math.PI * r * r)
      return { text: `Pizza bundar jari-jarinya ${r} cm (π ≈ 3.14). Luas pizzanya kira-kira berapa cm²? Bulatkan ya.`, answer: area, domain: 'mul', icon: 'ph:circle-fill' }
    },
    () => {
      const a = 2 + Math.floor(Math.random() * 4)
      return { text: `Sandi rahasia: A=${a}, B=${a + 1}, C=${a + 2}, D=${a + 3}. BD = ${a * 2 + 4}. Kalo DC = D + C = berapa?`, answer: (a + 3) + (a + 2), domain: 'logic', icon: 'ph:translate-fill' }
    },
    () => {
      return { text: 'Game: x=2, y=1. Lakukan 4 kali: simpan x dulu, x = x+y, y = simpanan tadi. Nilai x terakhir berapa?', answer: 5, domain: 'logic', icon: 'ph:terminal-fill' }
    },
    () => {
      return { text: 'Jam dinding nunjukin pukul 12:00 siang. 1 jam 5 menit kemudian, jarum PANJANG nunjuk ke angka berapa? (1-12)', answer: 1, domain: 'logic', icon: 'ph:clock-fill' }
    },
    () => {
      let v = 10
      for (let i = 0; i < 3; i++) v = v % 2 === 0 ? v * 3 - 1 : Math.floor(v / 2)
      return { text: `Skor game: 10. Tiap ronde: kalo genap → ×3 − 1. Kalo ganjil → ÷2 (buang sisanya). Setelah 3 ronde, skornya berapa?`, answer: v, domain: 'logic', icon: 'ph:git-branch-fill' }
    },
  ],
}

export function localUltimateProblems(count, level) {
  const templates = LOCAL_ULTIMATE[level] || LOCAL_ULTIMATE.easy
  const problems = []
  const seen = new Set()
  const shuffled = [...templates].sort(() => Math.random() - 0.5)

  for (let i = 0; i < count && problems.length < count; i++) {
    const t = shuffled[i % shuffled.length]
    const p = t()
    const key = `${p.answer}:${p.text.slice(0, 30)}`
    if (seen.has(key)) continue
    seen.add(key)
    problems.push({
      key: `local-ultimate:${level}:${problems.length}:${Date.now()}`,
      ...p,
      skill: `ultimate-${level}`,
      variant: 'word',
    })
  }
  return problems
}

// Generate soal Ultimate Mode dari AI panelis khusus — 80% visual/spasial.
// Bedas dari challengeProblems: fokus ke lateral thinking, logika pemrograman,
// creative thinking, dan problem solving. Gagal → localUltimateProblems.
export async function ultimateProblems(count, level, lang) {
  try {
    const { problems } = await withTimeout(
      api.ultimateProblems({ count, level, lang }), 15000,
    )
    return problems || null
  } catch {
    return null
  }
}
