import { useEffect, useState } from 'react'
import { dayKey, today, review, mastery, BADGES, xpFor, LEVELS, skillById } from './engine.js'
import { questDone } from './quests.js'
import { api, loggedIn } from './api.js'

const KEY = 'numquest.v1'

export const blank = () => ({
  v: 2,
  onboarded: false,
  handle: '',
  clanId: null,
  level: 'easy',
  goalMin: 5,
  xp: 0,
  coins: 0,
  streak: 0,
  bestStreak: 0,
  lastDay: null,
  lastSeen: null,
  shields: 1,
  hearts: 5,
  heartsAt: Date.now(),
  combo: 0,
  sessions: 0,
  fastCorrect: 0,
  perfectSets: 0,
  comebacks: 0,
  warSessions: 0,
  defenseWins: 0,
  questsDone: 0,
  challengeDone: null,   // dayKey terakhir tantangan harian diselesaikan
  defenseDay: null,      // dayKey terakhir ikut Pertahanan Kerajaan
  claimed: [],           // `${dayKey}:${questId}` yang hadiahnya sudah diambil
  skins: [],
  skin: '',
  days: {},              // dayKey -> {sec, problems, correct, xp, fast, maxCombo, dom:{}, form:{}, goalMet}
  srs: {},               // problemKey -> {ef,int,reps,due}
  skills: {},            // skillId -> {hist:[1|0...], days:[dayNum]}
  levelDays: {},
  badges: [],
  plan: null,            // {day, coach, quests, challenge}
  aiPath: { cleared: {} }, // nodeId -> bintang (1-3) dari Jalur AI
  items: { fifty: 0, askai: 0, freeze: 0, heartpotion: 0, shieldpotion: 0, doublexp: 0, reroll: 0, energydrink: 0, hintscroll: 0, explainscroll: 0 },
  energy: 5,
  energyDay: null,
  shieldActive: false,
  doubleXp: 0,
  claimedMilestones: [],
  reducedMotion: false,
  dyslexic: false,
  lang: 'id',
})

const emptyDay = () => ({ sec: 0, problems: 0, correct: 0, xp: 0, fast: 0, maxCombo: 0, dom: {}, form: {}, goalMet: false })

export function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return blank()
    return { ...blank(), ...JSON.parse(raw) }
  } catch {
    return blank()
  }
}

export const save = (g) => localStorage.setItem(KEY, JSON.stringify(g))

export function useGame() {
  const [g, setG] = useState(load)
  useEffect(() => save(g), [g])
  return [g, setG]
}

// Dorong progres ke server kalau sedang masuk. Gagal = diamkan; localStorage
// tetap sumber utama dan kiriman berikutnya membawa keadaan terbaru.
export const push = (g) => { if (loggedIn()) api.putState(g).catch(() => {}) }

const HEART_REFILL_MS = 4 * 3600 * 1000

// Nyawa penuh lagi di hari baru atau setelah 4 jam (PRD 8.1.3).
// Minimal 1 supaya tidak ada pengguna yang terkunci di luar latihannya sendiri —
// tujuan mekanik ini menahan buru-buru, bukan menghukum.
export function heartsNow(g) {
  if (g.lastSeen !== dayKey()) return 5
  if (Date.now() - g.heartsAt > HEART_REFILL_MS) return 5
  return Math.max(1, g.hearts)
}

// Energi harian — reset tiap hari, dipakai buat mulai sesi (1 sesi = 1 energi).
export function energyNow(g) {
  if (g.energyDay !== dayKey()) return 5
  return g.energy ?? 5
}

// Catat satu jawaban. Murni: terima state, kembalikan state baru.
export function recordAnswer(g, problem, { correct, hinted, explained, ms, mult = 1 }) {
  const d = dayKey()
  const t = today()
  // double_xp: setiap jawaban benar mengonsumsi 1 charge pengganda
  const dxp = correct && g.doubleXp > 0
  const effectiveMult = mult * (dxp ? 2 : 1)
  // Dibulatkan di sini: pengganda pecahan (energi 1.5×) bikin XP dan koin jadi
  // desimal, dan itu tampil apa adanya di layar ("524,5 koin").
  const xp = Math.round(xpFor({ correct, hinted, explained, ms }) * effectiveMult)
  const coinGain = correct ? Math.round(effectiveMult) : 0
  const day = { ...emptyDay(), ...g.days[d] }
  const sk = g.skills[problem.skill] || { hist: [], days: [] }
  const combo = correct ? (g.combo || 0) + 1 : 0
  const domain = skillById[problem.skill]?.domain
  // shield_active: salah pertama setelah aktivasi tidak kurangi nyawa
  const blocked = !correct && g.shieldActive

  return {
    ...g,
    xp: g.xp + xp,
    coins: g.coins + coinGain,
    combo,
    hearts: correct || blocked ? (correct ? g.hearts : g.hearts) : Math.max(0, g.hearts - 1),
    heartsAt: correct || blocked ? g.heartsAt : Date.now(),
    shieldActive: blocked ? false : g.shieldActive,
    doubleXp: dxp ? g.doubleXp - 1 : g.doubleXp,
    fastCorrect: g.fastCorrect + (correct && ms < 3000 ? 1 : 0),
    lastSeen: d,
    days: {
      ...g.days,
      [d]: {
        ...day,
        problems: day.problems + 1,
        correct: day.correct + (correct ? 1 : 0),
        xp: day.xp + xp,
        sec: day.sec + Math.round(ms / 1000),
        fast: day.fast + (correct && ms < 3000 ? 1 : 0),
        maxCombo: Math.max(day.maxCombo, combo),
        dom: correct && domain ? { ...day.dom, [domain]: (day.dom[domain] || 0) + 1 } : day.dom,
        form: correct ? { ...day.form, [problem.variant]: (day.form[problem.variant] || 0) + 1 } : day.form,
      },
    },
    srs: { ...g.srs, [problem.key]: review(g.srs[problem.key], correct, ms) },
    skills: { ...g.skills, [problem.skill]: { hist: [...sk.hist, correct ? 1 : 0].slice(-20), days: sk.days.includes(t) ? sk.days : [...sk.days, t] } },
  }
}

// Tutup sesi: streak, target harian, hari latihan per level, lencana.
export function finishSession(g, { seconds = 0, problems = 0, correct = 0, kind = 'normal' } = {}) {
  const d = dayKey()
  const day = { ...emptyDay(), ...g.days[d] }
  const goalMet = day.sec >= g.goalMin * 60 || day.problems >= Math.round(g.goalMin * 2.6)
  let { streak, lastDay, shields, comebacks, bestStreak } = g

  if (goalMet && lastDay !== d) {
    const prev = lastDay ? Math.round((new Date(d) - new Date(lastDay)) / 86400000) : 999
    if (prev === 1) streak += 1
    else if (prev === 2 && shields > 0) { streak += 1; shields -= 1 }
    else { if (g.lastDay && prev >= 7) comebacks += 1; streak = 1 }
    lastDay = d
    bestStreak = Math.max(bestStreak, streak)
  }

  const lvDays = { ...g.levelDays }
  if (goalMet && lastDay === d) lvDays[g.level] = (lvDays[g.level] || 0) + (g.days[d]?.goalMet ? 0 : 1)

  const perfect = correct === problems && problems >= 5
  // `let`, bukan `const` — blok milestone di bawah menukar objeknya utuh.
  let next = {
    ...g,
    streak, lastDay, shields, comebacks, bestStreak,
    combo: 0,
    sessions: g.sessions + 1,
    warSessions: g.warSessions + (kind === 'war' ? 1 : 0),
    challengeDone: kind === 'challenge' ? d : g.challengeDone,
    xp: g.xp + (goalMet && !g.days[d]?.goalMet ? 30 : 0),
    coins: g.coins + (perfect ? 20 : 0),
    perfectSets: g.perfectSets + (perfect ? 1 : 0),
    levelDays: lvDays,
    days: { ...g.days, [d]: { ...day, goalMet } },
  }
  next.badges = [...new Set([...next.badges, ...BADGES.filter((b) => b.test(next)).map((b) => b.id)])]

  // Item drop: 20% peluang kalau akurasinya ≥ 70% dari sesi ≥ 5 soal.
  const acc = problems ? correct / problems : 0
  if (acc >= 0.7 && problems >= 5 && Math.random() < 0.2) {
    const drop = SHOP_ITEMS[Math.floor(Math.random() * SHOP_ITEMS.length)]
    next.items = { ...next.items, [drop.id]: Math.min(ITEM_CAP, (next.items[drop.id] || 0) + 1) }
    next._lastDrop = drop.id
  }

  // XP milestone: periksa hadiah yang baru tercapai
  const msCheck = checkMilestones(next)
  if (msCheck.rewards.length) {
    next = msCheck.g
    next._milestones = msCheck.rewards
  }

  return next
}

// Ambil hadiah tugas harian. Sekali per tugas per hari — kuncinya tanggal + id.
export function claimQuest(g, q) {
  const tag = `${dayKey()}:${q.id}`
  if (g.claimed.includes(tag) || !questDone(q, g.days[dayKey()])) return g
  const next = {
    ...g,
    xp: g.xp + q.reward.xp,
    coins: g.coins + q.reward.coins,
    questsDone: g.questsDone + 1,
    claimed: [...g.claimed, tag].slice(-60),
  }
  next.badges = [...new Set([...next.badges, ...BADGES.filter((b) => b.test(next)).map((b) => b.id)])]
  return next
}

export const isClaimed = (g, q) => g.claimed.includes(`${dayKey()}:${q.id}`)

export const loseHeart = (g) => ({ ...g, hearts: Math.max(0, g.hearts - 1), heartsAt: Date.now() })

export const ITEM_CAP = 5

// XP milestone: tiap capai batas XP, user dapat bonus item/koin (sekali saja).
export const XP_MILESTONES = [
  { xp: 100,  reward: { type: 'item', id: 'hintscroll', count: 2 }, label: '2 Gulungan Petunjuk' },
  { xp: 250,  reward: { type: 'item', id: 'explainscroll', count: 2 }, label: '2 Gulungan Ilmu' },
  { xp: 500,  reward: { type: 'item', id: 'fifty', count: 2 }, label: '2× 50:50' },
  { xp: 1000, reward: { type: 'item', id: 'heartpotion', count: 2 }, label: '2 Ramuan Hati' },
  { xp: 2000, reward: { type: 'item', id: 'shieldpotion', count: 2 }, label: '2 Tameng Kilat' },
  { xp: 3500, reward: { type: 'item', id: 'freeze', count: 2 }, label: '2 Beku Waktu' },
  { xp: 5000, reward: { type: 'coins', amount: 300 }, label: '300 Koin' },
  { xp: 7500, reward: { type: 'item', id: 'doublexp', count: 3 }, label: '3 Bonus XP' },
  { xp: 10000, reward: { type: 'coins', amount: 500 }, label: '500 Koin' },
]

// Periksa milestone yang baru tercapai — kembalikan array hadiah yang belum diklaim.
export function checkMilestones(g) {
  const claimed = g.claimedMilestones || []
  const newly = XP_MILESTONES.filter((m) => g.xp >= m.xp && !claimed.includes(m.xp))
  if (!newly.length) return { g, rewards: [] }
  let next = { ...g, claimedMilestones: [...claimed, ...newly.map((m) => m.xp)] }
  const rewards = []
  for (const m of newly) {
    if (m.reward.type === 'coins') {
      next.coins = (next.coins || 0) + m.reward.amount
    } else if (m.reward.type === 'item') {
      const cur = next.items?.[m.reward.id] || 0
      next.items = { ...next.items, [m.reward.id]: Math.min(ITEM_CAP, cur + m.reward.count) }
    }
    rewards.push(m)
  }
  return { g: next, rewards }
}

// Katalog toko — deskripsi, harga, dan warna (tidak disimpan di state game).
export const SHOP_ITEMS = [
  { id: 'fifty',        name: '50:50',         desc: 'Hilangkan 2 jawaban salah',              nameKey: 'shop.fifty.name',   descKey: 'shop.fifty.desc',   icon: 'ph:percent-fill',      cost: 30, color: '#ffc86b' },
  { id: 'askai',        name: 'Tanya AI',      desc: 'AI jelasin langkah demi langkah',        nameKey: 'shop.askai.name',   descKey: 'shop.askai.desc',   icon: 'ph:robot-fill',        cost: 40, color: '#8d7bff' },
  { id: 'freeze',       name: 'Beku Waktu',    desc: 'Timer berhenti 10 detik',                nameKey: 'shop.freeze.name',  descKey: 'shop.freeze.desc',  icon: 'ph:snowflake-fill',     cost: 50, color: '#6bd5ff' },
  { id: 'heartpotion',  name: 'Ramuan Hati',   desc: 'Isi ulang 1 nyawa (maks 5)',             nameKey: 'shop.heartpotion.name',descKey: 'shop.heartpotion.desc',icon: 'ph:heart-straight-fill',cost: 60, color: '#ff6b6b' },
  { id: 'shieldpotion', name: 'Tameng Kilat',  desc: 'Tangkal 1× salah tanpa kehilangan nyawa', nameKey: 'shop.shieldpotion.name',descKey: 'shop.shieldpotion.desc',icon: 'ph:shield-star-fill',  cost: 45, color: '#8d7bff' },
  { id: 'doublexp',     name: 'Bonus XP',      desc: '3 jawaban benar berikutnya dapat 2× XP',  nameKey: 'shop.doublexp.name',descKey: 'shop.doublexp.desc',icon: 'ph:lightning-fill',     cost: 35, color: '#ffc86b' },
  { id: 'reroll',       name: 'Ganti Soal',    desc: 'Skip soal ini, dapat soal baru tanpa penalti', nameKey: 'shop.reroll.name',descKey: 'shop.reroll.desc',icon: 'ph:shuffle-fill', cost: 40, color: '#ff9f6b' },
  { id: 'energydrink',  name: 'Minuman Energi',desc: 'Isi ulang 2 energi — makin banyak bonus XP!',nameKey: 'shop.energydrink.name',descKey: 'shop.energydrink.desc',icon: 'ph:flask-fill',         cost: 55, color: '#3ec98a' },
  { id: 'hintscroll',   name: 'Gulungan Petunjuk', desc: 'Buka petunjuk 1 soal tanpa batas',    nameKey: 'shop.hintscroll.name',descKey: 'shop.hintscroll.desc',icon: 'ph:scroll-fill',       cost: 20, color: '#f4b942' },
  { id: 'explainscroll',name: 'Gulungan Ilmu',  desc: 'Lihat langkah penyelesaian 1 soal',      nameKey: 'shop.explainscroll.name',descKey: 'shop.explainscroll.desc',icon: 'ph:book-open-fill',    cost: 30, color: '#6bd5ff' },
]

export const shopItem = (id) => SHOP_ITEMS.find((it) => it.id === id)

// Klaim item gratis harian — cukup 1× per hari, acak dari katalog.
export function claimDailyItem(g) {
  const d = dayKey()
  if (g.dailyItemDay === d) return g
  const pick = SHOP_ITEMS[Math.floor(Math.random() * SHOP_ITEMS.length)]
  const owned = g.items?.[pick.id] || 0
  return {
    ...g,
    dailyItemDay: d,
    items: { ...g.items, [pick.id]: Math.min(ITEM_CAP, owned + 1) },
    _lastDailyItem: pick.id,
  }
}

// Beli 1 unit bantuan (koleksi habis pakai) — dijepit stok maksimum supaya tidak menimbun.
export function buyItem(g, id, cost) {
  const owned = g.items?.[id] || 0
  if (g.coins < cost || owned >= ITEM_CAP) return g
  return { ...g, coins: g.coins - cost, items: { ...g.items, [id]: owned + 1 } }
}

// Pakai 1 unit — dipanggil dari sesi saat lifeline dipicu.
export function useItem(g, id) {
  const owned = g.items?.[id] || 0
  if (owned <= 0) return g
  return { ...g, items: { ...g.items, [id]: owned - 1 } }
}

export const goalProgress = (g) => {
  const day = g.days[dayKey()]
  if (!day) return 0
  return Math.min(1, Math.max(day.sec / (g.goalMin * 60), day.problems / Math.round(g.goalMin * 2.6)))
}

export const last30 = (g) => {
  const out = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const k = dayKey(d)
    out.push({ key: k, label: d.getDate(), ...emptyDay(), ...g.days[k] })
  }
  return out
}

export const levelName = (l) => `${LEVELS[l].name} — ${LEVELS[l].title}`
export { mastery }
