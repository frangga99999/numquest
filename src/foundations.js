import { dayKey } from './engine.js'

// A separate concept map keeps supported practice out of the legacy speed/SRS score.
// skillId is the integration mapping to existing content, not a mastery equivalence.
export const FOUNDATION_CONCEPTS = [
  { id: 'quantity', skillId: 'ns-compare', title: 'Mengenal jumlah', short: 'Jumlah', symbol: '01', domain: 'ns', minutes: 5, prerequisite: null,
    description: 'Melihat angka sebagai sesuatu yang nyata.', target: 'Menghubungkan kumpulan benda dengan jumlahnya.',
    steps: ['Setiap titik mewakili satu benda. Ketuk titik untuk menandainya.', 'Hitung satu per satu. Titik yang sudah ditandai membantu kita menjaga urutan.', 'Angka terakhir yang kamu sebut adalah jumlah seluruh benda.'], example: [6, 0] },
  { id: 'addition', skillId: 'add-1d', title: 'Menjumlah dengan melihat', short: 'Penjumlahan', symbol: '+', domain: 'add', minutes: 7, prerequisite: 'quantity',
    description: 'Gabungkan dua kumpulan, lihat jumlahnya.', target: 'Menjumlah sampai 10 dengan bantuan kelompok benda.',
    steps: ['Ada dua kumpulan. Titik hijau adalah kumpulan pertama, titik jingga kumpulan kedua.', 'Mulai dari jumlah titik hijau, lalu hitung maju sebanyak titik jingga.', 'Menjumlah berarti menggabungkan. Semua titik tetap ikut dihitung.'], example: [4, 3] },
  { id: 'subtraction', skillId: 'sub-1d', title: 'Memahami yang tersisa', short: 'Pengurangan', symbol: '−', domain: 'sub', minutes: 7, prerequisite: 'addition',
    description: 'Kurangi sedikit, lalu amati sisanya.', target: 'Mengurangi sampai 10 dan memeriksa sisanya.',
    steps: ['Bayangkan kartu di meja. Sebagian akan diambil.', 'Titik yang dicoret sudah diambil. Hitung hanya titik yang masih utuh.', 'Kamu juga bisa memeriksa: sisa ditambah yang diambil harus sama dengan jumlah awal.'], example: [8, 3] },
  { id: 'multiplication', skillId: 'mul-concept', title: 'Melihat pola perkalian', short: 'Perkalian', symbol: '×', domain: 'mul', minutes: 8, prerequisite: 'addition',
    description: 'Beberapa kelompok dengan isi yang sama.', target: 'Memahami perkalian sebagai kelompok sama banyak.',
    steps: ['Bayangkan tiga baris kartu desain. Setiap baris berisi empat kartu.', 'Ketuk satu kelompok. Ada empat titik di dalamnya. Setiap kelompok memiliki isi yang sama.', 'Tiga kelompok berisi empat dapat ditulis 4 + 4 + 4, atau 3 × 4.'], example: [3, 4] },
  { id: 'division', skillId: 'div-concept', title: 'Membagi dengan adil', short: 'Pembagian', symbol: '÷', domain: 'div', minutes: 8, prerequisite: 'multiplication',
    description: 'Bagi benda ke kelompok yang sama banyak.', target: 'Membagi rata dan menemukan isi setiap kelompok.',
    steps: ['Ada dua belas kartu yang akan dibagi ke tiga kelompok.', 'Tekan “Bagikan satu putaran”. Setiap kelompok mendapat satu kartu. Ulangi sampai habis.', 'Sekarang hitung isi satu kelompok. Itulah hasil pembagian.'], example: [12, 3] },
  { id: 'families', skillId: 'div-easy', title: 'Satu pola, empat hubungan', short: 'Hubungan angka', symbol: '↔', domain: 'div', minutes: 8, prerequisite: 'division',
    description: 'Hubungkan perkalian dengan pembagian.', target: 'Menggunakan fakta perkalian untuk membantu pembagian.',
    steps: ['Dua kelompok berisi empat memiliki delapan benda.', 'Karena 2 × 4 = 8, membagi delapan ke dua kelompok memberi empat per kelompok.', 'Satu hubungan membantu mengingat yang lain: 2 × 4 = 8, 4 × 2 = 8, 8 ÷ 2 = 4, dan 8 ÷ 4 = 2.'], example: [8, 2] },
  { id: 'everyday', skillId: 'mul-concept', title: 'Angka dalam keseharian', short: 'Penerapan', symbol: '=', domain: 'mul', minutes: 8, prerequisite: 'multiplication',
    description: 'Gunakan kelompok untuk kebutuhan nyata.', target: 'Menghitung jumlah kartu dari beberapa paket.',
    steps: ['Satu paket berisi empat kartu. Kamu membutuhkan tiga paket.', 'Gambarkan setiap paket sebagai satu kelompok. Isi tiap kelompok sama.', 'Kita mencari jumlah seluruh kartu, jadi gunakan perkalian: 3 × 4.'], example: [3, 4] },
]
export const conceptById = Object.fromEntries(FOUNDATION_CONCEPTS.map(c => [c.id, c]))
export const FOUNDATION_FLAG = import.meta.env?.VITE_NUMERACY_FOUNDATIONS !== 'false'
export const emptyFoundation = () => ({ version: 1, diagnostic: null, preferences: { minutes: 10, range: '7', reducedMotion: false }, concepts: {}, history: [], sessions: [], active: null })
export const foundationOf = g => ({ ...emptyFoundation(), ...g.foundation, preferences: { ...emptyFoundation().preferences, ...g.foundation?.preferences } })
export const uuid = () => globalThis.crypto?.randomUUID?.() || `f-${Date.now()}-${Math.random().toString(36).slice(2)}`

export function makeExercise(id, index = 0, seed = 0) {
  const c = conceptById[id]
  if (!c) throw new Error('Konsep Fondasi tidak dikenal')
  const n = ((index + seed) % 6 + 6) % 6
  let a, b, answer, text, visual
  if (id === 'quantity') {
    a = [4, 7, 5, 8, 6, 9][n]; b = 0; answer = a; visual = 'count'; text = 'Ada berapa titik di sini?'
  } else if (id === 'addition') {
    a = [3, 4, 2, 5, 6, 3][n]; b = [2, 3, 6, 4, 2, 4][n]; answer = a + b; visual = 'add'; text = `${a} + ${b} = ?`
  } else if (id === 'subtraction') {
    a = [7, 9, 6, 8, 10, 5][n]; b = [2, 4, 3, 6, 3, 2][n]; answer = a - b; visual = 'sub'; text = `${a} − ${b} = ?`
  } else if (id === 'multiplication' || id === 'everyday') {
    a = [2, 3, 4, 2, 3, 4][n]; b = [3, 2, 3, 4, 4, 2][n]; answer = a * b; visual = 'groups'
    text = id === 'everyday' ? `Ada ${a} paket, masing-masing berisi ${b} kartu. Berapa kartu seluruhnya?` : `${a} kelompok berisi ${b}. Berapa seluruhnya?`
  } else {
    b = [2, 3, 4, 2, 3, 4][n]; answer = [3, 2, 3, 4, 4, 2][n]; a = b * answer; visual = 'divide'; text = `${a} kartu dibagi rata ke ${b} kelompok. Berapa isi setiap kelompok?`
  }
  const dimension = id === 'everyday' ? 'application' : id !== 'quantity' && index % 3 === 1 ? 'calculation' : 'conceptual'
  if (dimension === 'calculation' && ['multiplication', 'division', 'families'].includes(id)) text = `${a} ${visual === 'groups' ? '×' : '÷'} ${b} = ?`
  return { id: `${id}:${a}:${b}:${dimension}`, conceptId: id, skill: c.skillId, domain: c.domain, a, b, answer, text, visual, dimension }
}

export function exampleExercise(id) {
  const c = conceptById[id], [a, b] = c.example
  const e = makeExercise(id)
  return { ...e, a, b, answer: e.visual === 'count' ? a : e.visual === 'add' ? a + b : e.visual === 'sub' ? a - b : e.visual === 'groups' ? a * b : a / b }
}

export function explanation(e) {
  if (e.visual === 'count') return `Setiap titik dihitung sekali. Seluruhnya ada ${e.answer} titik.`
  if (e.visual === 'add') return `Mulai dari ${e.a}, tambah ${e.b} lagi. ${e.a} + ${e.b} = ${e.answer}.`
  if (e.visual === 'sub') return `Dari ${e.a} titik, ${e.b} dicoret. Tersisa ${e.answer}. Periksa: ${e.answer} + ${e.b} = ${e.a}.`
  if (e.visual === 'groups') return `${Array(e.a).fill(e.b).join(' + ')} = ${e.answer}. Jadi ${e.a} × ${e.b} = ${e.answer}.`
  return `${e.a} dibagi ke ${e.b} kelompok. Masing-masing mendapat ${e.answer}. Periksa: ${e.b} × ${e.answer} = ${e.a}.`
}

export function hintFor(e) {
  return ({ count: 'Tandai titik satu per satu agar tidak terhitung dua kali.', add: `Mulai dari ${e.a}, lalu maju ${e.b} langkah.`, sub: 'Hitung titik yang tidak dicoret.', groups: `Jumlahkan ${e.b} sebanyak ${e.a} kali.`, divide: `Cari angka yang jika dikali ${e.b} menghasilkan ${e.a}.` })[e.visual]
}

// A wrong answer alone cannot establish a learner's cognitive error type.
export function errorSignal(e, given) {
  if (given === e.answer) return null
  if (e.visual === 'groups' && given === e.a + e.b) return { type: 'OPERATION_CONFUSION', confidence: 'POSSIBLE', error_type: 'UNKNOWN' }
  if (e.visual === 'sub' && given === e.a + e.b) return { type: 'OPERATION_CONFUSION', confidence: 'POSSIBLE', error_type: 'UNKNOWN' }
  return { type: 'NEEDS_OBSERVATION', confidence: 'UNKNOWN', error_type: 'UNKNOWN' }
}

export function masteryFor(f, id) {
  const evidence = f.history.filter(e => e.concept_id === id && e.event_type === 'exercise_answered' && e.metadata.attempt === 1 && !e.metadata.assisted).slice(-12)
  const sessions = new Set(evidence.map(e => e.metadata.session_id)).size
  // At least two sessions and six independent answers before displaying mastery.
  const enough = evidence.length >= 6 && sessions >= 2
  const score = enough ? Math.round(evidence.filter(e => e.metadata.correct).length / evidence.length * 100) : null
  const durations = evidence.filter(e => e.metadata.correct && e.metadata.response_time_seconds != null).map(e => e.metadata.response_time_seconds).sort((a, b) => a - b)
  return { score, count: evidence.length, confidence: enough ? 'ESTIMATE' : 'INSUFFICIENT', medianSeconds: durations.length >= 3 ? Math.round(durations[Math.floor(durations.length / 2)]) : null,
    status: score === null ? (f.concepts[id]?.completed ? 'Sedang dibangun' : 'Belum cukup data') : score >= 80 ? 'Sudah kuat' : score >= 65 ? 'Cukup mandiri' : 'Perlu penguatan' }
}

export function reviewQueue(f, now = Date.now()) {
  return FOUNDATION_CONCEPTS.filter(c => f.concepts[c.id]?.reviewDue != null && f.concepts[c.id].reviewDue <= now)
    .sort((a, b) => f.concepts[a.id].reviewDue - f.concepts[b.id].reviewDue)
}

export function recommendation(f, now = Date.now()) {
  const review = reviewQueue(f, now)[0]
  if (review) return { concept: review, type: 'REVIEW', reason: 'Review singkat untuk melihat apa yang masih kamu ingat.' }
  const last = f.sessions.at(-1)
  if (last && last.independent < 2) return { concept: conceptById[last.conceptId], type: 'REMEDIAL', reason: 'Coba satu contoh lagi dengan bantuan visual, lalu lihat apakah polanya lebih jelas.' }
  const firstGap = f.diagnostic?.answers.find(a => a.correct !== true)?.conceptId
  let next = firstGap && !f.concepts[firstGap]?.completed ? conceptById[firstGap] : FOUNDATION_CONCEPTS.find(c => !f.concepts[c.id]?.completed)
  next ||= FOUNDATION_CONCEPTS.find(c => masteryFor(f, c.id).score === null || masteryFor(f, c.id).score < 65) || FOUNDATION_CONCEPTS[0]
  const prerequisite = next.prerequisite && masteryFor(f, next.prerequisite)
  if (prerequisite?.score != null && prerequisite.score < 45) return { concept: conceptById[next.prerequisite], type: 'REMEDIAL', reason: `Bangun dulu dasar yang membantu memahami ${next.short.toLowerCase()}.` }
  return { concept: next, type: 'CONTINUE', reason: 'Satu konsep kecil, dengan contoh yang bisa kamu lihat.' }
}

export function startFoundation(g, conceptId, kind = 'learn', now = Date.now()) {
  const f = foundationOf(g), sessionId = uuid()
  const seed = f.sessions.filter(s => s.conceptId === conceptId).length * 3
  const active = { sessionId, conceptId, kind, phase: kind === 'review' ? 'practice' : 'lesson', step: 0, index: 0, seed, attempt: 1, assisted: false, answered: false, feedback: null, seconds: 0, startedAt: now }
  return { ...g, foundation: { ...f, active, history: [...f.history, event(g, conceptId, 'lesson_started', { session_id: sessionId, kind }, now)] } }
}

function event(g, conceptId, type, metadata, now) {
  return { event_id: uuid(), user_id: g.handle || null, event_type: type, module_id: 'numeracy-foundations', lesson_id: conceptId, concept_id: conceptId, timestamp: now, local_date: dayKey(new Date(now)), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, metadata }
}

export function recordFoundationAnswer(g, given, seconds = 0, now = Date.now()) {
  const f = foundationOf(g), a = f.active
  if (!a || a.answered || !Number.isFinite(given) || a.phase !== 'practice') return g
  const e = makeExercise(a.conceptId, a.index, a.seed), correct = given === e.answer
  const sec = Math.min(300, Math.max(0, Number.isFinite(seconds) ? seconds : 0))
  const ev = { ...event(g, a.conceptId, 'exercise_answered', { correct, given, attempt: a.attempt, assisted: a.assisted, response_time_seconds: sec, session_id: a.sessionId, dimension: e.dimension, error_signal: errorSignal(e, given) }, now), exercise_id: `${a.sessionId}:${a.index}:${e.id}` }
  const d = ev.local_date, day = { sec: 0, problems: 0, correct: 0, xp: 0, fast: 0, maxCombo: 0, dom: {}, form: {}, goalMet: false, ...g.days?.[d] }
  // The legacy accuracy counts first submissions only, never retry-to-correct.
  const first = a.attempt === 1
  return { ...g,
    days: { ...g.days, [d]: { ...day, sec: day.sec + sec, problems: day.problems + (first ? 1 : 0), correct: day.correct + (first && correct ? 1 : 0), dom: { ...day.dom, [e.domain]: (day.dom[e.domain] || 0) + (first && correct ? 1 : 0) } } },
    foundation: { ...f, history: [...f.history, ev], active: { ...a, seconds: a.seconds + sec, answered: true, feedback: { correct, given, explanation: explanation(e) } } } }
}

export function foundationHelp(g, type = 'hint_requested', now = Date.now()) {
  const f = foundationOf(g), a = f.active
  if (!a) return g
  const ev = event(g, a.conceptId, type, { session_id: a.sessionId, index: a.index }, now)
  return { ...g, foundation: { ...f, active: { ...a, assisted: true }, history: [...f.history, ev] } }
}

export function completeFoundation(g, now = Date.now()) {
  const f = foundationOf(g), a = f.active
  if (!a || a.phase !== 'practice' || a.index !== 2 || !a.answered || f.sessions.some(s => s.id === a.sessionId)) return g
  const answers = f.history.filter(e => e.event_type === 'exercise_answered' && e.metadata.session_id === a.sessionId && e.metadata.attempt === 1)
  const independent = answers.filter(e => !e.metadata.assisted && e.metadata.correct).length
  const mastery = masteryFor(f, a.conceptId)
  const days = mastery.score >= 80 ? 7 : independent >= 2 ? 3 : 1
  const session = { id: a.sessionId, conceptId: a.conceptId, kind: a.kind, timestamp: now, date: dayKey(new Date(now)), seconds: a.seconds, correct: answers.filter(e => e.metadata.correct).length, independent, total: answers.length, mastery: mastery.score }
  return { ...g, foundation: { ...f, active: null, concepts: { ...f.concepts, [a.conceptId]: { completed: true, lastPracticed: now, reviewDue: now + days * 86400000 } }, sessions: [...f.sessions, session], history: [...f.history, event(g, a.conceptId, a.kind === 'review' ? 'topic_reviewed' : 'lesson_completed', { session_id: a.sessionId, mastery_score: mastery.score }, now)] } }
}

export function summarizeFoundation(f, start, end) {
  const events = f.history.filter(e => e.local_date >= start && e.local_date <= end && e.event_type === 'exercise_answered')
  const first = events.filter(e => e.metadata.attempt === 1)
  const sessions = f.sessions.filter(s => s.date >= start && s.date <= end)
  return { seconds: events.reduce((n, e) => n + (e.metadata.response_time_seconds || 0), 0), attempts: first.length, accuracy: first.length ? Math.round(first.filter(e => e.metadata.correct).length / first.length * 100) : null, sessions: sessions.length, reviews: sessions.filter(s => s.kind === 'review').length, activeDays: new Set(events.map(e => e.local_date)).size }
}

export function rangeDates(range, now = new Date()) {
  const end = dayKey(now), start = new Date(now)
  start.setDate(start.getDate() - (Number(range) - 1))
  return { start: dayKey(start), end }
}
