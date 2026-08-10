// Logika pelatih yang tidak butuh model: ringkasan keadaan pengguna, pelatih
// cadangan, dan penempatan level dari diagnostik. Dipakai klien dan server.

import { skillsOf, mastery, levelStatus, nextLevel, LEVELS } from './engine.js'

export const snapshot = (g) => ({
  level: g.level,
  hari_latihan_di_level: g.levelDays?.[g.level] || 0,
  minimal_hari: LEVELS[g.level].minDays,
  streak: g.streak,
  menit_target: g.goalMin,
  status: (() => {
    const s = levelStatus(g)
    return { akurasi: +(s.acc * 100).toFixed(0), persen_emas: +(s.goldPct * 100).toFixed(0), siap: s.ready, kurang: s.missing }
  })(),
  skill: skillsOf(g.level).map((s) => {
    const m = mastery(g.skills?.[s.id])
    return { id: s.id, nama: s.name, wilayah: s.domain, tingkat: m.tier, akurasi: +(m.acc * 100).toFixed(0), percobaan: m.n }
  }),
})

export function localCoach(g) {
  const st = levelStatus(g)
  const weak = skillsOf(g.level)
    .map((s) => ({ s, m: mastery(g.skills?.[s.id]) }))
    .sort((a, b) => a.m.acc - b.m.acc || a.m.n - b.m.n)
    .slice(0, 3)
  const nx = nextLevel(g.level)
  return {
    focus: weak.map((w) => w.s.id),
    message: st.attempts === 0
      ? `Gas mulai dari basic. Hari ini kenalan dulu sama ${weak[0].s.name.toLowerCase()}, ${g.goalMin} menit doang kok.`
      : `Hari ini fokus ke ${weak.map((w) => w.s.name.toLowerCase()).join(', ')}. Akurasimu sekarang ${Math.round(st.acc * 100)}% — santai aja, pelan-pelan.`,
    canAdvance: st.ready && !!nx,
    advice: st.ready
      ? (nx ? `Kamu udah siap naik ke tingkat ${LEVELS[nx].name}!` : 'Semua tingkat udah kamu kuasai. Pertahanin terus dengan latihan harian.')
      : `Belum saatnya naik tingkat nih: ${st.missing.join(', ')}.`,
    source: 'lokal',
  }
}

// Penempatan level dari diagnostik awal — murni lokal, tanpa jaringan.
export const DIAGNOSTIC = ['add-1d', 'sub-20', 'mul-easy', 'add-2d-carry', 'mul-tables', 'div-facts', 'pct-of', 'frac-add-diff']

export function placeLevel(results) {
  const score = (ids) => ids.reduce((a, id) => a + (results[id] ? 1 : 0), 0) / ids.length
  if (score(['add-1d', 'sub-20', 'mul-easy']) < 0.8) return 'easy'
  if (score(['add-2d-carry', 'mul-tables', 'div-facts']) < 0.7) return 'easy'
  if (score(['pct-of', 'frac-add-diff']) < 0.5) return 'mid'
  return 'adv'
}
