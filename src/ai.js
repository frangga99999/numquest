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
    // ── Visual (80%) — pakai analogi sehari-hari ───────────────────────────
    () => {
      const n = 2 + Math.floor(Math.random() * 4)
      const terms = []
      for (let i = 0; i < 5; i++) terms.push(n + i * 3)
      return { text: `Level game: ${terms.slice(0, 4).join(', ')}, ? — tiap naik level XP nambah berapa?`, answer: 3, domain: 'logic', icon: 'ph:shapes-fill' }
    },
    () => {
      const start = Math.floor(Math.random() * 4)
      const steps = 1 + Math.floor(Math.random() * 3)
      const end = (start + steps) % 4
      const dir = ['Utara', 'Timur', 'Selatan', 'Barat']
      return { text: `Kompos HP: hadap ${dir[start]}. Layar diputar kanan ${steps}×. Sekarang hadap mana? (1=Utara,2=Timur,3=Selatan,4=Barat)`, answer: end + 1, domain: 'logic', icon: 'ph:compass-fill' }
    },
    () => {
      const mul = 2 + Math.floor(Math.random() * 4)
      return { text: `Stiker di album 2×2: halaman 1 isi ${mul}, halaman 3 isi ${mul * 3}. Satu halaman isi kelipatan ${mul}. Halaman 2 isi berapa?`, answer: mul * 2, domain: 'logic', icon: 'ph:grid-nine-fill' }
    },
    () => {
      return { text: 'Antrean di kafe: Ana di depan Budi. Citra di antara Ana & Budi. Dodi paling belakang. Ana di posisi ke berapa? (1=paling depan)', answer: 1, domain: 'logic', icon: 'ph:users-fill' }
    },
    () => {
      const a = 2 + Math.floor(Math.random() * 5)
      const b = a + 1 + Math.floor(Math.random() * 3)
      return { text: `Di toko buah: 🍎 + 🍊 = ${a + b}. Harga 🍎 = ${a}. Harga 🍊 berapa?`, answer: b, domain: 'logic', icon: 'ph:sparkle-fill' }
    },
    () => {
      const n = 3 + Math.floor(Math.random() * 5)
      return { text: `Papan catur mini ${n}×${n} petak. Total petak di seluruh papan ada berapa?`, answer: n * n, domain: 'mul', icon: 'ph:cube-fill' }
    },
    () => {
      const n = 2 + Math.floor(Math.random() * 4)
      return { text: `Kode redeem: A=${n}, B=${n * 2}, C=${n * 3}. Kode "BC" = B + C = berapa?`, answer: n * 5, domain: 'logic', icon: 'ph:translate-fill' }
    },
    // ── Logic (20%) ────────────────────────────────────────────────────────
    () => {
      const x = 1 + Math.floor(Math.random() * 4)
      return { text: `Game RPG: HP awal=${x}. Kena buff +3 HP, lalu heal 2× lipat. HP akhir?`, answer: (x + 3) * 2, domain: 'logic', icon: 'ph:terminal-fill' }
    },
    () => {
      const words = [{ w: 'DUA', n: 3 }, { w: 'LIMA', n: 4 }, { w: 'TUJUH', n: 5 }]
      const p = words[Math.floor(Math.random() * words.length)]
      return { text: `Teka-teki: 1=3, 2=3, 3=5. Rahasianya: jumlah HURUF! Kata "${p.w}" = berapa?`, answer: p.n, domain: 'logic', icon: 'ph:brain-fill' }
    },
    () => {
      const n = 2 + Math.floor(Math.random() * 4)
      let val = n
      for (let i = 0; i < 3; i++) val = val % 2 === 0 ? val / 2 : val * 3 + 1
      return { text: `Botol ramuan ajaib: isi ${n}ml. Aturan: genap→minum setengah, ganjil→tambah 2×+1. Setelah 3 langkah, isi botol?`, answer: val, domain: 'logic', icon: 'ph:git-branch-fill' }
    },
  ],

  mid: [
    () => {
      const n = 2 + Math.floor(Math.random() * 3)
      const terms = [n]
      for (let i = 1; i < 5; i++) terms.push(terms[i - 1] * 2 + 1)
      return { text: `Quest harian: ${terms.slice(0, 4).join(', ')}, ? — tiap quest XP = (sebelumnya×2)+1. Quest ke-5 dapat berapa XP?`, answer: terms[4], domain: 'logic', icon: 'ph:shapes-fill' }
    },
    () => {
      const ops = [
        { text: 'Dadu main monopoly: sisi atas=1, depan=3, kanan=5. Digulingkan ke KANAN 1×. Sisi atas sekarang?', answer: 5 },
        { text: 'Dadu: atas=6, depan=2, kanan=4. Digulingkan ke BAWAH 1×. Sisi depan sekarang?', answer: 6 },
        { text: 'Dadu: atas=3, depan=1, kanan=5. Guling KANAN 2×. Sisi kanan sekarang?', answer: 1 },
      ]
      const p = ops[Math.floor(Math.random() * ops.length)]
      return { ...p, domain: 'logic', icon: 'ph:compass-fill' }
    },
    () => {
      const r = 2 + Math.floor(Math.random() * 4)
      return { text: `Menu combo kafe 3 tier: tier1=[${r},${r * 2},${r * 3}], tier2=[${r * 2},${r * 4},${r * 6}], tier3=[${r * 3},?,${r * 9}]. Harga kelipatan ${r}. Cari ?`, answer: r * 6, domain: 'logic', icon: 'ph:grid-nine-fill' }
    },
    () => {
      return { text: '5 pemain game melingkar: A di antara B & C. D berseberangan dgn B. E di kiri C. Di posisi berapa A? (1-5, searah jarum jam, B di pos 1)', answer: 2, domain: 'logic', icon: 'ph:users-fill' }
    },
    () => {
      const a = 3 + Math.floor(Math.random() * 5)
      const b = a + 2
      return { text: `Combo hemat: 🍔+🥤=${a + b}rb, 🍔×🥤=${a * b}rb, 🍔<🥤. Selisih harga 🥤−🍔?`, answer: b - a, domain: 'logic', icon: 'ph:sparkle-fill' }
    },
    () => {
      const l = 3 + Math.floor(Math.random() * 5)
      const w = 2 + Math.floor(Math.random() * 4)
      return { text: `Karpet ${l}×${w} meter diputar 90°. Luasnya tetap berapa?`, answer: l * w, domain: 'mul', icon: 'ph:cube-fill' }
    },
    () => {
      return { text: 'Kode redeem game: A=1, B=2, C=3, D=4. Kode "CAB" = 3+1+2 = 6. Kode "BAD" = berapa?', answer: 7, domain: 'logic', icon: 'ph:translate-fill' }
    },
    () => {
      return { text: 'Tukar isi 2 dompet: kiri=8rb, kanan=13rb. Pindah semua kanan ke kiri, lalu kiri kasih 5rb ke kanan. Isi kiri sekarang?', answer: 13, domain: 'logic', icon: 'ph:terminal-fill' }
    },
    () => {
      const w = ['SATU', 'DUA', 'ENAM', 'TUJUH'][Math.floor(Math.random() * 4)]
      return { text: `Puzzle viral: 1=3, 2=3, 3=5, 4=3, 5=4. Rahasianya: jumlah HURUF! "${w}" = berapa?`, answer: w.length, domain: 'logic', icon: 'ph:brain-fill' }
    },
    () => {
      const s = 3 + Math.floor(Math.random() * 8)
      let v = s
      for (let i = 0; i < 4; i++) v = v % 2 === 0 ? v / 2 : v + 1
      return { text: `Scores game: ${s} poin. Loop 4×: genap→poin/2, ganjil→poin+1. Poin akhir?`, answer: v, domain: 'logic', icon: 'ph:git-branch-fill' }
    },
  ],

  adv: [
    () => {
      const terms = [1, 1]
      for (let i = 2; i < 6; i++) terms.push(terms[i - 1] + terms[i - 2])
      return { text: `Level dungeon (Fibonacci): ${terms.slice(0, 5).join(', ')}, ? — cari level ke-6!`, answer: terms[5], domain: 'logic', icon: 'ph:shapes-fill' }
    },
    () => {
      return { text: 'Kubus rubik: dpn=1, atas=2, kanan=3, kiri=4, bwh=5, blkg=6. Putar KANAN→ATAS→KANAN. Sisi DEPAN sekarang?', answer: 5, domain: 'logic', icon: 'ph:compass-fill' }
    },
    () => {
      return { text: 'Kotak ajaib 3×3: tiap baris/kolom/diagonal jumlahnya 15. Tengah=5, pojok kiri atas=2. Pojok kanan bawah angka berapa?', answer: 8, domain: 'logic', icon: 'ph:grid-nine-fill' }
    },
    () => {
      return { text: '6 tamu di meja 2 baris × 3 kolom. Ali di depan Budi. Citra di kanan Ali. Dodi di belakang Citra. Eka di kiri Budi. Fani di kanan Eka. Posisi Budi? (1-6)', answer: 5, domain: 'logic', icon: 'ph:users-fill' }
    },
    () => {
      const x = 2 + Math.floor(Math.random() * 6)
      const y = x + 1 + Math.floor(Math.random() * 4)
      const z = y + 1 + Math.floor(Math.random() * 3)
      return { text: `Kode sandi: ◆◇ + ◇◆ = ${x * 10 + y + y * 10 + x}. ◆=${y}, ◇=${x}. ◆×◇+?=${y * x + z}. Berapa ?`, answer: z, domain: 'logic', icon: 'ph:sparkle-fill' }
    },
    () => {
      const r = 3 + Math.floor(Math.random() * 4)
      const area = Math.round(Math.PI * r * r)
      return { text: `Pizza bulat jari-jari ${r} cm. π≈3.14. Luas pizza kira-kira berapa cm²? (bulatkan)`, answer: area, domain: 'mul', icon: 'ph:circle-fill' }
    },
    () => {
      const a = 2 + Math.floor(Math.random() * 4)
      return { text: `Kode sandi: A=${a}, B=${a + 1}, C=${a + 2}, D=${a + 3}. "BD" = ${a * 2 + 4}. "DC" = berapa?`, answer: (a + 3) + (a + 2), domain: 'logic', icon: 'ph:translate-fill' }
    },
    () => {
      return { text: 'Loop game: x=2, y=1. 4× putaran: simpan=x, x=x+y, y=simpan. x akhir? (kayak Fibonacci!)', answer: 5, domain: 'logic', icon: 'ph:terminal-fill' }
    },
    () => {
      return { text: 'Jam dinding: pukul 12:00 siang. Setelah 1 jam 5 menit, jarum PANJANG nunjuk ke angka berapa? (1-12)', answer: 1, domain: 'logic', icon: 'ph:clock-fill' }
    },
    () => {
      let v = 10
      for (let i = 0; i < 3; i++) v = v % 2 === 0 ? v * 3 - 1 : Math.floor(v / 2)
      return { text: `Game RPG: skor awal 10. Setiap ronde: genap→skor×3−1, ganjil→skor/2 (bulatkan bawah). Setelah 3 ronde, skor akhir?`, answer: v, domain: 'logic', icon: 'ph:git-branch-fill' }
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
