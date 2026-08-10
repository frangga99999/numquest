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
// Kalau gagal/timeout/belum login, kembalikan null (pemanggil jatuh ke buildSession).
export async function challengeProblems(count, level, domain) {
  if (!loggedIn()) return null
  try {
    const { problems } = await withTimeout(
      api.challengeProblems({ count, level, domain }), 9000,
    )
    return problems || null
  } catch {
    return null
  }
}

// Penjelasan dadakan buat lifeline "Tanya AI" — null kalau gagal, pemanggil
// jatuh ke langkah "why" bawaan soal.
export async function explainProblem(problem) {
  if (!loggedIn()) return null
  try {
    const { explanation } = await withTimeout(
      api.explainProblem({ text: problem.text, answer: problem.answer }), 8000,
    )
    return explanation || null
  } catch {
    return null
  }
}

export { DIAGNOSTIC, placeLevel }
