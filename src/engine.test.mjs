// Satu pemeriksaan yang bisa dijalankan: `npm test`
// Menjaga hal-hal yang kalau rusak tidak kelihatan di UI: generator soal,
// bangun-ulang kartu SRS dari kunci, ambang penguasaan, dan gerbang naik tingkat.
import assert from 'node:assert/strict'
import {
  SKILLS, newProblem, problemFromKey, review, mastery, levelStatus,
  buildSession, buildingLevels, skillsOf, today, VARIANTS,
} from './engine.js'

// 1. Tiap skill menghasilkan soal yang sah, 200x (parameter acak harus selalu aman)
for (const s of SKILLS) {
  for (let i = 0; i < 200; i++) {
    const p = newProblem(s.id)
    assert.ok(p.text && p.text.length > 0, `${s.id}: teks kosong`)
    assert.ok(p.answer !== undefined && p.answer !== null && !Number.isNaN(p.answer), `${s.id}: jawaban tidak valid`)
    if (typeof p.answer === 'number') assert.ok(Number.isFinite(p.answer), `${s.id}: jawaban tak hingga`)
    assert.ok(Array.isArray(p.why) && p.why.length, `${s.id}: tidak ada langkah penjelasan`)
    // jawaban berupa teks (pecahan) WAJIB pilihan ganda — keypad tidak bisa mengetiknya
    if (typeof p.answer === 'string') assert.ok(p.choices, `${s.id}: jawaban teks tanpa pilihan ganda`)
    if (p.choices) {
      assert.ok(p.choices.length >= 2, `${s.id}: pilihan terlalu sedikit`)
      assert.ok(p.choices.map(String).includes(String(p.answer)), `${s.id}: jawaban tidak ada di pilihan`)
      assert.equal(new Set(p.choices.map(String)).size, p.choices.length, `${s.id}: pilihan duplikat`)
    }
  }
}

// 2. Kunci SRS bisa membangun ulang soal yang persis sama (syarat SRS per-fakta)
for (const s of SKILLS) {
  const p = newProblem(s.id)
  const again = problemFromKey(p.key)
  assert.equal(again.text, p.text, `${s.id}: soal tidak bisa dibangun ulang dari kunci`)
  assert.equal(String(again.answer), String(p.answer), `${s.id}: jawaban berubah saat dibangun ulang`)
}

// 2b. Ragam bentuk soal: tiap bentuk harus tetap punya jawaban benar & bisa dibangun ulang
let varied = 0
for (const s of SKILLS) {
  for (const kind of VARIANTS) {
    for (let i = 0; i < 30; i++) {
      const p = newProblem(s.id, kind)
      assert.ok(p.text && p.answer !== undefined && p.answer !== null, `${s.id}/${kind}: soal rusak`)
      assert.ok(!Number.isNaN(p.answer), `${s.id}/${kind}: jawaban NaN`)
      assert.ok(p.why.length, `${s.id}/${kind}: tidak ada penjelasan`)
      if (typeof p.answer === 'string') assert.ok(p.choices, `${s.id}/${kind}: jawaban teks tanpa pilihan`)
      if (p.choices) assert.ok(p.choices.map(String).includes(String(p.answer)), `${s.id}/${kind}: jawaban tidak ada di pilihan`)
      const back = problemFromKey(p.key)
      assert.equal(back.text, p.text, `${s.id}/${kind}: tidak bisa dibangun ulang dari kunci`)
      assert.equal(String(back.answer), String(p.answer), `${s.id}/${kind}: jawaban berubah saat dibangun ulang`)
      if (p.variant !== 'plain') varied++
    }
  }
}
assert.ok(varied > 500, `ragam bentuk terlalu jarang terpakai (${varied})`)

// 2c. Bentuk "cari yang hilang" harus benar-benar menghasilkan operan yang hilang
const gap = problemFromKey('mul-tables:7,8:gap')
assert.equal(gap.text, '7 × ? = 56')
assert.equal(gap.answer, 8)
const tf = problemFromKey('add-2d:20,30:tf')
assert.ok(['Benar', 'Salah'].includes(tf.answer))
assert.equal(problemFromKey('div-facts:7,6:gap').text, '42 : ? = 6')

// 3. SM-2: benar memperpanjang interval, salah mengembalikan ke 1 hari
let c = review(undefined, true, 2000)
assert.equal(c.int, 1)
c = review(c, true, 2000); assert.equal(c.int, 3)
c = review(c, true, 2000); assert.ok(c.int > 3, 'interval harus tumbuh')
assert.ok(c.ef <= 3, 'ease factor dibatasi 3.0')
const after = review(c, false, 9000)
assert.equal(after.int, 1, 'salah harus reset interval')
assert.ok(after.ef >= 1.3, 'ease factor tidak boleh di bawah 1.3')
assert.equal(review({ ef: 1.3, int: 5, reps: 3, due: 0 }, false, 1000).ef, 1.3, 'lantai ease factor')

// 4. Ambang penguasaan sesuai Lampiran C
assert.equal(mastery({ hist: [], days: [] }).tier, 'locked')
assert.equal(mastery({ hist: Array(10).fill(1), days: [1] }).tier, 'bronze')
assert.equal(mastery({ hist: Array(15).fill(1), days: [1] }).tier, 'silver')
assert.equal(mastery({ hist: Array(20).fill(1), days: [1, 2] }).tier, 'silver', '3 hari berbeda wajib untuk emas')
assert.equal(mastery({ hist: Array(20).fill(1), days: [1, 2, 3] }).tier, 'gold')
assert.equal(mastery({ hist: [...Array(16).fill(1), ...Array(4).fill(0)], days: [1, 2, 3] }).tier, 'silver', '80% belum cukup untuk emas')

// 5. Gerbang naik tingkat tidak boleh terbuka sebelum semua syarat terpenuhi
const perfect = { level: 'easy', skills: {}, levelDays: { easy: 14 } }
for (const s of skillsOf('easy')) perfect.skills[s.id] = { hist: Array(20).fill(1), days: [1, 2, 3] }
assert.equal(levelStatus(perfect).ready, true, 'sempurna + 14 hari harus siap naik')
assert.equal(levelStatus({ ...perfect, levelDays: { easy: 3 } }).ready, false, 'kurang hari tidak boleh lolos')
assert.equal(levelStatus({ level: 'easy', skills: {}, levelDays: { easy: 30 } }).ready, false, 'tanpa latihan tidak boleh lolos')

// 6. Sesi: dijepit 10-15 soal (anti burnout), tanpa soal duplikat, semuanya sah
const fresh = { level: 'easy', skills: {}, srs: {}, levelDays: {} }
for (const min of [5, 10, 30]) {
  const list = buildSession(fresh, min)
  assert.ok(list.length >= 10 && list.length <= 15, `sesi ${min} menit di luar jepitan 10-15 (${list.length})`)
  assert.equal(new Set(list.map((p) => p.key)).size, list.length, 'ada soal duplikat dalam satu sesi')
  assert.ok(list.every((p) => p.answer !== undefined), 'ada soal rusak dalam sesi')
}

// 7. Kartu yang jatuh tempo benar-benar masuk ke sesi ulangan
const dueKey = newProblem('add-1d').key
const withDue = { ...fresh, srs: { [dueKey]: { ef: 2.5, int: 1, reps: 1, due: today() - 1 } } }
assert.ok(buildSession(withDue, 10).some((p) => p.key === dueKey), 'kartu jatuh tempo tidak dijadwalkan')

// 8. Kerajaan: kosong = 0, penguasaan penuh = level maksimum
assert.equal(buildingLevels({ skills: {} }).add, 0)
const all = { skills: Object.fromEntries(SKILLS.map((s) => [s.id, { hist: Array(20).fill(1), days: [1, 2, 3] }])) }
assert.ok(Object.values(buildingLevels(all)).every((v) => v === 5), 'penguasaan penuh harus memberi bangunan level 5')

// 8b. Tugas & tantangan harian: berbeda tiap hari, dan yang dijanjikan bisa ditepati
const { localQuests, localChallenge, questProgress, questDone } = await import('./quests.js')

for (const level of ['easy', 'mid', 'adv']) {
  const gq = { level, goalMin: 10, skills: {}, srs: {}, levelDays: {} }
  const judul = new Set()
  for (let seed = 0; seed < 28; seed++) {
    const qs = localQuests(gq, seed)
    assert.equal(qs.length, 3, `${level}/${seed}: harus 3 tugas`)
    assert.equal(new Set(qs.map((q) => q.kind)).size, 3, `${level}/${seed}: jenis tugas tidak boleh kembar`)
    assert.ok(qs.every((q) => q.target > 0 && q.title && q.reward.xp > 0), `${level}/${seed}: tugas tidak lengkap`)
    judul.add(qs.map((q) => q.kind).join())

    // tantangan harian harus benar-benar bisa menghasilkan bentuk yang dijanjikan
    const ch = localChallenge(gq, seed)
    const list = buildSession(gq, 0, [], { count: ch.count, domain: ch.domain, variantBias: ch.variantBias })
    assert.equal(list.length, ch.count, `${level}/${seed}: jumlah soal tantangan meleset`)
    if (ch.variantBias !== 'plain')
      assert.ok(list.some((p) => p.variant === ch.variantBias),
        `${level}/${seed}: tantangan "${ch.title}" menjanjikan bentuk ${ch.variantBias} tapi wilayahnya tidak bisa menghasilkannya`)
  }
  assert.ok(judul.size >= 3, `${level}: susunan tugas terlalu monoton (${judul.size} variasi)`)
}

// tugas hanya selesai kalau targetnya benar-benar tercapai
const qTest = { id: 'x', kind: 'fast', target: 5 }
assert.equal(questProgress(qTest, { fast: 2 }), 0.4)
assert.equal(questDone(qTest, { fast: 4 }), false)
assert.equal(questDone(qTest, { fast: 5 }), true)
assert.equal(questProgress(qTest, undefined), 0, 'hari kosong tidak boleh bikin galat')

// 9. Streak & nyawa (logika tanggal — gampang salah, tidak kelihatan di UI)
const { finishSession, heartsNow, blank } = await import('./store.js')
const { dayKey } = await import('./engine.js')
const D = dayKey()
const ago = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d) }
const met = { [D]: { sec: 400, problems: 20, correct: 18, xp: 100, goalMet: false } }

const first = finishSession({ ...blank(), days: met }, { seconds: 400, problems: 20, correct: 18 })
assert.equal(first.streak, 1, 'sesi pertama memulai streak')
assert.equal(first.comebacks, 0, 'sesi pertama bukan "kembali bangkit"')
assert.ok(!first.badges.includes('comeback'), 'lencana comeback tidak boleh muncul di hari pertama')
assert.equal(first.days[D].goalMet, true)

assert.equal(finishSession({ ...blank(), streak: 4, lastDay: ago(1), days: met }, {}).streak, 5, 'hari berturut menambah streak')
const shielded = finishSession({ ...blank(), streak: 9, shields: 1, lastDay: ago(2), days: met }, {})
assert.equal(shielded.streak, 10, 'perisai menyelamatkan satu hari bolong')
assert.equal(shielded.shields, 0, 'perisai terpakai')
assert.equal(finishSession({ ...blank(), streak: 9, shields: 0, lastDay: ago(2), days: met }, {}).streak, 1, 'tanpa perisai streak reset')
const comeback = finishSession({ ...blank(), streak: 30, lastDay: ago(9), days: met }, {})
assert.equal(comeback.comebacks, 1, 'kembali setelah 7+ hari dihitung')
// sesi kedua di hari yang sama tidak boleh menambah streak dua kali
assert.equal(finishSession(first, { seconds: 100, problems: 5, correct: 5 }).streak, 1, 'streak hanya sekali per hari')

// target belum tercapai -> streak tidak jalan
assert.equal(finishSession({ ...blank(), days: { [D]: { sec: 30, problems: 2, correct: 1, xp: 5, goalMet: false } } }, {}).streak, 0)

assert.equal(heartsNow({ ...blank(), hearts: 0, lastSeen: ago(1) }), 5, 'hari baru = nyawa penuh')
assert.equal(heartsNow({ ...blank(), hearts: 0, lastSeen: D, heartsAt: Date.now() }), 1, 'tidak pernah terkunci total')
assert.equal(heartsNow({ ...blank(), hearts: 0, lastSeen: D, heartsAt: Date.now() - 5 * 3600e3 }), 5, 'isi ulang setelah 4 jam')

// 9b. Hadiah milestone XP — jalur ini pernah bikin seluruh layar blank karena
// objek hasilnya ditukar lewat variabel const. Sekali kena, sesi tidak bisa ditutup.
const ms = finishSession({ ...blank(), xp: 600, claimedMilestones: [] }, { seconds: 60, problems: 10, correct: 10 })
assert.ok(ms._milestones?.length >= 1, 'milestone XP yang terlampaui harus diberikan')
assert.ok(ms.items.hintscroll > 0, 'hadiah milestone harus benar-benar masuk ke inventori')
assert.equal(
  finishSession({ ...blank(), xp: 600, claimedMilestones: [100, 250, 500] }, { seconds: 60, problems: 10, correct: 10 })._milestones,
  undefined, 'milestone yang sudah diklaim tidak boleh dibagikan dua kali')

// 10. Skor tantangan: combo naikin pengganda, peringkat ikut skor
const { comboMult, scoreFor, challengeTarget, rankFor } = await import('./engine.js')
assert.equal(comboMult(0), 1); assert.equal(comboMult(2), 1.5)
assert.equal(comboMult(4), 2); assert.equal(comboMult(9), 3)
assert.ok(scoreFor({ combo: 6, ms: 0, limitMs: 30000 }) > scoreFor({ combo: 0, ms: 0, limitMs: 30000 }), 'combo harus menaikkan skor')
assert.ok(scoreFor({ combo: 1, ms: 1000, limitMs: 30000 }) > scoreFor({ combo: 1, ms: 29000, limitMs: 30000 }), 'jawab cepat harus lebih tinggi')
assert.equal(rankFor(challengeTarget(10), challengeTarget(10)).key, 'S', 'skor pas target = peringkat S')
assert.equal(rankFor(0, challengeTarget(10)).key, 'D')
assert.ok(rankFor(0, 0).key, 'target 0 tidak boleh bikin galat')

console.log(`✓ ${SKILLS.length} skill × ${VARIANTS.length} bentuk, ${SKILLS.length * (200 + VARIANTS.length * 30)} soal acak, SRS, penguasaan, sesi, tugas & tantangan harian, kerajaan, streak & nyawa — semua lolos`)
