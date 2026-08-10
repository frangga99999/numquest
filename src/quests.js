// Tugas harian & tantangan bertema. Dipakai klien dan server (ESM murni).
// Mekaniknya lokal dan terukur; AI hanya memilih, mengatur takarannya, dan
// menulis judulnya — supaya tugas selalu bisa diperiksa tanpa memanggil model.

import { DOMAINS, VARIANT_NAME, skillsOf, supportsVariants } from './engine.js'

// Wilayah yang soalnya bisa muncul dalam bentuk lain (cari yang hilang / benar-salah /
// bandingkan). Soal cerita dan pecahan tidak punya pola "A op B = ?".
export const variantDomains = (level) =>
  [...new Set(skillsOf(level).filter((s) => supportsVariants(s.id)).map((s) => s.domain))]

export const QUEST_KINDS = {
  problems: { label: 'Jumlah soal', of: (d) => d.problems },
  correct: { label: 'Jawaban benar', of: (d) => d.correct },
  fast: { label: 'Jawaban kilat', of: (d) => d.fast || 0 },
  combo: { label: 'Rentetan benar', of: (d) => d.maxCombo || 0 },
  minutes: { label: 'Menit latihan', of: (d) => Math.floor((d.sec || 0) / 60) },
  domain: { label: 'Benar di satu wilayah', of: (d, q) => (d.dom || {})[q.param] || 0 },
  variant: { label: 'Bentuk soal tertentu', of: (d, q) => (d.form || {})[q.param] || 0 },
}

const REWARD = { problems: 15, correct: 20, fast: 30, combo: 30, minutes: 20, domain: 25, variant: 25 }

export const questProgress = (q, day) =>
  Math.min(1, (QUEST_KINDS[q.kind]?.of(day || {}, q) || 0) / q.target)

export const questDone = (q, day) => questProgress(q, day) >= 1

// Generator lokal: 3 tugas berbeda tiap hari, ditentukan tanggal (bukan acak),
// jadi tugas yang sama muncul di semua perangkat pengguna pada hari yang sama.
export function localQuests(g, daySeed) {
  const domains = [...new Set(skillsOf(g.level).map((s) => s.domain))]
  const dom = domains[daySeed % domains.length]
  const forms = ['gap', 'tf', 'cmp']
  const form = forms[daySeed % forms.length]
  const base = Math.max(8, Math.round(g.goalMin * 2))
  const canVary = variantDomains(g.level).length > 0

  const pool = [
    { kind: 'problems', target: base + (daySeed % 5), title: `Kerjakan ${base + (daySeed % 5)} soal hari ini`, desc: 'Benar atau belum benar, dua-duanya dihitung.' },
    { kind: 'correct', target: Math.round(base * 0.7), title: `Kumpulkan ${Math.round(base * 0.7)} jawaban benar`, desc: 'Pelan tidak apa-apa.' },
    { kind: 'fast', target: 5 + (daySeed % 4), title: `${5 + (daySeed % 4)} jawaban di bawah 3 detik`, desc: 'Yang sudah hafal, keluarkan cepat.' },
    { kind: 'combo', target: 6 + (daySeed % 5), title: `Rentetan ${6 + (daySeed % 5)} benar beruntun`, desc: 'Fokus, jangan buru-buru.' },
    { kind: 'minutes', target: g.goalMin, title: `Latihan ${g.goalMin} menit`, desc: 'Target harianmu.' },
    { kind: 'domain', param: dom, target: 8 + (daySeed % 5), title: `${8 + (daySeed % 5)} benar di ${DOMAINS[dom].name}`, desc: `Wilayah ${DOMAINS[dom].region} sedang butuh perhatian.` },
    { kind: 'variant', param: form, target: 5 + (daySeed % 3), title: `${5 + (daySeed % 3)} benar bentuk "${VARIANT_NAME[form]}"`, desc: 'Soal yang sama, cara baca berbeda.' },
  ].filter((q) => q.kind !== 'variant' || canVary) // jangan beri tugas yang tidak mungkin selesai
  // tiga tugas berbeda, bergeser tiap hari
  return [0, 1, 2]
    .map((i) => pool[(daySeed * 3 + i * 2) % pool.length])
    .filter((q, i, a) => a.findIndex((x) => x.kind === q.kind) === i)
    .concat(pool)
    .filter((q, i, a) => a.findIndex((x) => x.kind === q.kind) === i)
    .slice(0, 3)
    .map((q, i) => ({ id: `${q.kind}-${i}`, ...q, reward: { xp: REWARD[q.kind], coins: Math.round(REWARD[q.kind] / 2) } }))
}

// Tantangan bertema harian: satu sesi khusus, hadiah ganda, fokus satu wilayah.
export const CHALLENGE_MODS = [
  { id: 'blitz', name: 'Serbuan Kilat', desc: 'Soal pendek beruntun. Kecepatan dihitung.', nameKey: 'chmod.blitz.name', descKey: 'chmod.blitz.desc', variantBias: 'plain', mult: 2 },
  { id: 'riddle', name: 'Teka-teki Menara', desc: 'Semua soal berbentuk "cari yang hilang".', nameKey: 'chmod.riddle.name', descKey: 'chmod.riddle.desc', variantBias: 'gap', mult: 2 },
  { id: 'judge', name: 'Sidang Angka', desc: 'Nilai pernyataan: benar atau salah.', nameKey: 'chmod.judge.name', descKey: 'chmod.judge.desc', variantBias: 'tf', mult: 2 },
  { id: 'duel', name: 'Duel Timbangan', desc: 'Bandingkan dua hitungan, pilih yang lebih besar.', nameKey: 'chmod.duel.name', descKey: 'chmod.duel.desc', variantBias: 'cmp', mult: 2 },
  { id: 'mystery', name: 'Ruang Misteri', desc: 'Teka-teki logika, pola, dan deduksi — asah otak!', nameKey: 'chmod.mystery.name', descKey: 'chmod.mystery.desc', domainBias: 'logic', mult: 3 },
  { id: 'combo', name: 'Rantai Juara', desc: 'Soal berantai: jawaban soal 1 jadi input soal 2.', nameKey: 'chmod.combo.name', descKey: 'chmod.combo.desc', variantBias: 'plain', mult: 3, combo: true },
  { id: 'boss', name: 'Bos Terakhir', desc: 'Soal susah semua — multi-langkah, untuk yang berani!', nameKey: 'chmod.boss.name', descKey: 'chmod.boss.desc', levelBias: 'adv', mult: 4 },
]

export function localChallenge(g, daySeed) {
  const all = [...new Set(skillsOf(g.level).map((s) => s.domain))]
  const varied = variantDomains(g.level)
  let mod = CHALLENGE_MODS[daySeed % CHALLENGE_MODS.length]
  // mod dengan domainBias langsung pakai domain itu, cek apakah tersedia
  let domain
  if (mod.domainBias) {
    domain = all.includes(mod.domainBias) ? mod.domainBias : all[0]
  } else {
    const pool = mod.variantBias === 'plain' ? all : varied
    if (!pool.length) mod = CHALLENGE_MODS[0]
    domain = (pool.length ? pool : all)[(daySeed * 2) % (pool.length || all.length)]
  }
  return {
    ...mod,
    domain,
    count: mod.levelBias === 'adv' ? 10 : 12,
    title: `${mod.name}: ${DOMAINS[domain].region}`,
    desc: mod.desc,
    reward: { xp: mod.mult * 30, coins: mod.mult * 20 },
  }
}
