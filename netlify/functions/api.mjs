// Netlify Function — proxy AI endpoint ke DeepSeek.
// Menangani /api/lessons, /api/learn/chat, /api/coach, /api/quests,
// /api/challenge, /api/problem/flavor, /api/problem/explain.
// Tanpa SQLite, tanpa auth — cukup AI_KEY dari environment Netlify.

import { skillsOf, levelStatus, nextLevel, DOMAINS, VARIANT_NAME, today } from '../../src/engine.js'
import { snapshot, localCoach } from '../../src/coach.js'
import { localQuests, localChallenge } from '../../src/quests.js'

const KEY = process.env.AI_KEY
const BASE = process.env.AI_BASE || 'https://api.deepseek.com/v1'
const MODEL = process.env.AI_MODEL || 'deepseek-chat'

const TONE = `Kamu pelatih aritmatika untuk orang dewasa 25-40 tahun yang kesulitan berhitung (diskalkulia / trauma matematika).
Bahasa: hangat, singkat, bahasa Indonesia sehari-hari. Dilarang: kata "salah/gagal/bodoh/mudah sekali", istilah klinis, membandingkan dengan orang lain, dan tanda seru berlebihan.
Sebut angka nyata dari data yang diberikan. Jangan mengarang data.`

const DEFAULTS = { level: 'easy', goalMin: 5, xp: 0, streak: 0, skills: {}, srs: {}, days: {}, levelDays: {} }
const parseState = (body) => {
  try { return { ...DEFAULTS, ...(body?.state || {}) } } catch { return { ...DEFAULTS } }
}

const str = (v, max = 240) => {
  const s = String(v ?? '').trim()
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[ ,;:-]+$/, '') + '…'
}

const num = (v, lo, hi, dflt) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt
}

// ── AI chat helper ──────────────────────────────────────────────────────────
async function chat(system, user, schemaHint, { timeout = 25_000, maxTokens, tone } = {}) {
  if (!KEY) throw new Error('AI_KEY belum diatur')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  const prefix = tone !== undefined ? tone : TONE
  try {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        ...(maxTokens ? { max_tokens: maxTokens } : {}),
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `${prefix}\n${system}\nBalas HANYA JSON: ${schemaHint}` },
          { role: 'user', content: JSON.stringify(user) },
        ],
      }),
    })
    if (!res.ok) throw new Error(`AI ${res.status}: ${(await res.text()).slice(0, 200)}`)
    const data = await res.json()
    return JSON.parse(data.choices[0].message.content)
  } finally {
    clearTimeout(timer)
  }
}

// ── Lessons ─────────────────────────────────────────────────────────────────
const VISUAL_SPEC = `Pilih SATU bentuk visual dan isi parameternya (angka kecil, mudah dicerna):
- {"kind":"items","a":3,"b":2,"op":"+","labelA":"punya","labelB":"dikasih","labelResult":"apel"}
- {"kind":"groups","g":3,"p":4}
- {"kind":"pie","pies":[{"slices":4,"filled":1,"label":"seperempat"}]}
- {"kind":"grid100","filled":25}
- {"kind":"numberline","from":0,"to":20,"start":8,"jumps":[4]}
- {"kind":"bars","bars":[{"label":"Andi","value":3},{"label":"Budi","value":7}],"caption":"..."}
- {"kind":"steps","boxes":[{"title":"Langkah 1","eq":"99 + 1 = 100","note":"bulatkan"}]}`

const VISUAL_KINDS = new Set(['items', 'groups', 'pie', 'grid100', 'numberline', 'bars', 'steps'])

function cleanVisual(v) {
  if (!v || !VISUAL_KINDS.has(v.kind)) return null
  const k = v.kind
  if (k === 'items') return { kind: k, a: num(v.a, 1, 12, 3), b: num(v.b, 1, 12, 2), op: v.op === '-' ? '-' : '+', labelA: str(v.labelA, 14), labelB: str(v.labelB, 14), labelResult: str(v.labelResult, 14) }
  if (k === 'groups') return { kind: k, g: num(v.g, 2, 5, 3), p: num(v.p, 1, 6, 4) }
  if (k === 'pie') {
    const pies = (Array.isArray(v.pies) ? v.pies : []).slice(0, 3)
      .map((p) => { const s = num(p?.slices, 1, 12, 4); return { slices: s, filled: num(p?.filled, 0, s, 1), label: str(p?.label, 16) } })
    return pies.length ? { kind: k, pies } : null
  }
  if (k === 'grid100') return { kind: k, filled: num(v.filled, 0, 100, 25) }
  if (k === 'numberline') {
    const from = num(v.from, 0, 100, 0), to = num(v.to, from + 1, 120, from + 20)
    return { kind: k, from, to, start: num(v.start, from, to, from), jumps: (Array.isArray(v.jumps) ? v.jumps : []).slice(0, 4).map((j) => num(j, -50, 50, 0)).filter(Boolean) }
  }
  if (k === 'bars') {
    const bars = (Array.isArray(v.bars) ? v.bars : []).slice(0, 5)
      .map((b) => ({ label: str(b?.label, 10), value: num(b?.value, 0, 1000, 0) })).filter((b) => b.label)
    return bars.length ? { kind: k, bars, caption: str(v.caption, 48) } : null
  }
  if (k === 'steps') {
    const boxes = (Array.isArray(v.boxes) ? v.boxes : []).slice(0, 3)
      .map((b) => ({ title: str(b?.title, 24), eq: str(b?.eq, 28), note: str(b?.note, 40) })).filter((b) => b.eq)
    return boxes.length ? { kind: k, boxes } : null
  }
  return null
}

const LEVEL_NAME = { easy: 'Dasar (baru mulai berhitung)', mid: 'Menengah', adv: 'Mahir' }
const LANG_RULE = {
  id: `Tulis SEMUA teks dalam bahasa Indonesia GAUL ala Jakarta SELATAN — santai, akrab, kayak ngobrol sama temen di kafe. Pakai kata: "gue", "lo", "nih", "dong", "deh", "sih", "kan", "ya", "banget", "aja". JANGAN pakai: "Anda", "jika", "maka", "tentukan", "berapakah", "hitunglah" — itu bahasa robot, bukan manusia.`,
  en: 'Write ALL text in casual, friendly English. Keep sentences short and plain.',
}

async function lessonsHandler(level, lang) {
  const out = await chat(
    `Susun 6 materi panduan matematika untuk tingkat "${LEVEL_NAME[level] || level}".
Sasaran pembaca: orang DEWASA yang merasa bodoh matematika dan trauma sejak sekolah. Jadi: tanpa jargon, tanpa rumus telanjang, semua dijelaskan lewat benda/kejadian sehari-hari.
Tiap materi berisi:
- "title": maks 4 kata, memikat, bukan nama bab buku pelajaran
- "domain": salah satu dari ${Object.keys(DOMAINS).join(', ')}
- "hook": 1 kalimat pembuka yang bikin penasaran, kaitkan ke kejadian nyata
- "intro": 1-2 kalimat inti konsepnya, bahasa sangat sederhana
- "visual": spesifikasi visual (lihat aturan di bawah) yang BENAR-BENAR mewakili contoh di intro
- "steps": tepat 3 langkah, tiap langkah {"eq": "tulisan hitungannya, maks 20 karakter", "text": "penjelasan 1 kalimat pendek"}
- "tip": 1 trik praktis yang bisa langsung dipakai
- "analogy": 1 analogi sehari-hari (jajan, ojek online, main game, masak, gajian)
- "why": 1 kalimat kenapa ini kepakai di kehidupan nyata

${VISUAL_SPEC}

Angka di "visual" HARUS konsisten dengan contoh di "intro" dan "steps".
${LANG_RULE[lang] || LANG_RULE.id} Ini termasuk label di dalam "visual" — semuanya harus satu bahasa, jangan campur.
Dilarang: emoji, dan kata yang merendahkan. Buat 6 materi dengan domain yang BERBEDA-BEDA.`,
    { tingkat: level, bahasa: lang },
    '{"lessons":[{"title":"...","domain":"add","hook":"...","intro":"...","visual":{"kind":"..."},"steps":[{"eq":"...","text":"..."}],"tip":"...","analogy":"...","why":"..."}]}',
    { timeout: 90_000, maxTokens: 4000 },
  )

  const seen = new Set()
  const list = (out.lessons || []).map((l, i) => {
    const domain = DOMAINS[l.domain] ? l.domain : 'add'
    const visual = cleanVisual(l.visual)
    const steps = (Array.isArray(l.steps) ? l.steps : []).slice(0, 3)
      .map((s) => ({ eq: str(s?.eq, 24), text: str(s?.text, 110) })).filter((s) => s.text)
    const title = str(l.title, 34)
    if (!title || !visual || steps.length < 2) return null
    let id = `${domain}-${i}`
    while (seen.has(id)) id += 'x'
    seen.add(id)
    return { id, title, domain, level, content: { hook: str(l.hook, 120), intro: str(l.intro, 200), visual, steps, tip: str(l.tip, 140), analogy: str(l.analogy, 160), why: str(l.why, 140) } }
  }).filter(Boolean)

  if (!list.length) throw new Error('Model tidak mengembalikan materi yang sah')
  return { lessons: list, source: 'ai', cached: false, aiReady: true }
}

// ── Learn Chat ──────────────────────────────────────────────────────────────
async function learnChatHandler(g, message, topic, history = [], lang = 'id') {
  const out = await chat(
    `Kamu guru matematika yang sabar dan suka pakai analogi sehari-hari.
Jawab pertanyaan user dengan SANGAT sederhana — maksimal 4 kalimat pendek.
${LANG_RULE[lang] || LANG_RULE.id}
Kalau bisa, kasih satu analogi yang relatable (jajan, ojek online, main game, masak).
Topik yang sedang dibahas: ${topic || 'matematika dasar'}.
JANGAN pakai istilah teknis yang bikin pusing, JANGAN pakai emoji. Jelaskan kayak ke teman yang baru belajar.
Setelah menjawab, usulkan 2 pertanyaan lanjutan singkat (maks 6 kata) yang mungkin ditanyakan user berikutnya, dalam bahasa yang sama.`,
    { pesan: message, topik: topic, tingkat: g.level, bahasa: lang, obrolan_sebelumnya: history.slice(-4) },
    '{"jawaban":"...","lanjutan":["...","..."]}',
  )
  return {
    reply: str(out.jawaban, 400),
    followups: (Array.isArray(out.lanjutan) ? out.lanjutan : []).slice(0, 2).map((s) => str(s, 40)).filter(Boolean),
    source: 'ai',
  }
}

// ── Coach ───────────────────────────────────────────────────────────────────
async function coachHandler(g) {
  const base = localCoach(g)
  try {
    const out = await chat(
      `Pilih maksimal 3 skill fokus hari ini dari daftar, tulis satu pesan (maks 2 kalimat), nilai kesiapan naik tingkat, dan tentukan jumlah soal sesi (10–15).
Gaya bahasa: santai dan gaul ala obrolan sehari-hari orang Jakarta.
Syarat naik tingkat: ketepatan >= 85%, minimal 70% skill emas, dan hari latihan >= minimal_hari.`,
      snapshot(g),
      '{"focus":["skill-id"],"message":"...","canAdvance":true|false,"advice":"...","sessionCount":12}',
    )
    const valid = new Set(skillsOf(g.level).map((s) => s.id))
    const st = levelStatus(g)
    const focus = (out.focus || []).filter((f) => valid.has(f)).slice(0, 3)
    const rawCount = Number(out.sessionCount)
    const sessionCount = Number.isFinite(rawCount) ? Math.min(15, Math.max(10, Math.round(rawCount))) : 12
    return { ...base, focus: focus.length ? focus : base.focus, message: str(out.message) || base.message, advice: str(out.advice) || base.advice, sessionCount, canAdvance: !!out.canAdvance && st.ready && !!nextLevel(g.level), source: 'ai' }
  } catch (e) {
    return { ...base, error: String(e.message).slice(0, 160) }
  }
}

// ── Quests ──────────────────────────────────────────────────────────────────
async function questsHandler(g, daySeed) {
  const base = localQuests(g, daySeed)
  try {
    const out = await chat(
      `Susun 3 tugas harian yang berbeda. Jenis: problems, correct, fast, combo, minutes, domain, variant.
Wilayah: ${Object.entries(DOMAINS).map(([id, d]) => `${id} (${d.name})`).join(', ')}.
Bentuk soal: ${Object.entries(VARIANT_NAME).map(([k, v]) => `${k} (${v})`).join(', ')}.
Gaya santai ala Jakarta. Judul maks 8 kata. Takaran selesai dalam ${g.goalMin}–${g.goalMin * 2} menit.`,
      { ...snapshot(g), tugas_kemarin: base.map((q) => q.kind) },
      '{"quests":[{"kind":"...","param":"...","target":10,"title":"...","desc":"..."}]}',
    )
    const kinds = new Set(['problems', 'correct', 'fast', 'combo', 'minutes', 'domain', 'variant'])
    const picked = (out.quests || [])
      .filter((q) => kinds.has(q.kind))
      .filter((q) => q.kind !== 'domain' || DOMAINS[q.param])
      .filter((q) => q.kind !== 'variant' || VARIANT_NAME[q.param])
      .slice(0, 3)
      .map((q, i) => {
        const cap = { problems: [8, 60], correct: [5, 45], fast: [3, 25], combo: [4, 20], minutes: [g.goalMin, g.goalMin * 3], domain: [4, 25], variant: [3, 20] }[q.kind]
        const fallback = base[i] || base[0]
        return {
          id: `${q.kind}-${i}`, kind: q.kind, param: q.param,
          target: Math.min(cap[1], Math.max(cap[0], Math.round(Number(q.target) || cap[0]))),
          title: str(q.title, 70) || fallback.title, desc: str(q.desc, 120) || fallback.desc, reward: fallback.reward,
        }
      })
    return { quests: picked.length === 3 ? picked : base }
  } catch { return { quests: base } }
}

// ── Challenge ───────────────────────────────────────────────────────────────
async function challengeHandler(g, daySeed) {
  const base = localChallenge(g, daySeed)
  try {
    const out = await chat(
      `Beri nama dan satu kalimat cerita untuk tantangan harian bertema kerajaan.
Mekanik: wilayah "${DOMAINS[base.domain]?.region || ''}" (${DOMAINS[base.domain]?.name || ''}), bentuk "${VARIANT_NAME[base.variantBias]}".
Gaya santai Jakarta. Nama maks 5 kata. Jangan menjanjikan hadiah.`,
      { wilayah: DOMAINS[base.domain], bentuk: VARIANT_NAME[base.variantBias], hari: daySeed % 7 },
      '{"title":"...","desc":"..."}',
    )
    return { ...base, title: str(out.title, 60) || base.title, desc: str(out.desc, 140) || base.desc, source: 'ai' }
  } catch { return base }
}

// ── Flavor ──────────────────────────────────────────────────────────────────
async function flavorHandler(problems, g) {
  const plain = problems.filter((p) => /=\s*\?$/.test(p.text))
  if (!plain.length) return { variants: {} }
  try {
    const out = await chat(
      `Ubah tiap soal hitung polos jadi kalimat yang SERU & BERVARIASI — kayak misi di game, bukan PR.

ATURAN KETAT:
- Angka dan operasi (+ − × :) HARUS SAMA PERSIS seperti aslinya — jangan diubah sedikit pun.
- Setiap soal harus KONTEKS BERBEDA: gaming, masak, olahraga, traveling, musik, sci-fi, dagang, kucing, cuaca, konser — jangan ulangi tema.
- Gunakan bahasa seru kayak ngomong ke temen, santai Jakarta.
- Maks 20 kata per soal. Akhiri dengan pertanyaan yang jelas.
- Balas array dengan id dan jumlah SAMA PERSIS seperti input.`,
      { tingkat: g.level, soal: plain.map((p) => ({ id: p.key, teks: p.text })) },
      '{"soal":[{"id":"...","teks":"..."}]}',
    )
    const map = {}
    for (const item of out.soal || []) {
      const orig = plain.find((p) => p.key === item.id)
      if (!orig) continue
      const t = str(item.teks, 160)
      const nums = orig.text.match(/\d+(?:,\d+)?/g) || []
      if (t && nums.every((n) => t.includes(n))) map[item.id] = t
    }
    return { variants: map }
  } catch { return { variants: {} } }
}

// ── Explain ─────────────────────────────────────────────────────────────────
// Format: 2 tips — cara biasa (langkah standar) + cara tercepat (shortcut/trik).
// Setiap tip punya judul pendek dan 2-3 langkah konkret.
async function explainHandler(problem, g) {
  try {
    const out = await chat(
      `Kamu tutor matematika gaul. User BARU SALAH menjawab soal ini. Tugasmu: kasih 2 cara menyelesaikannya — cara BIASA (langkah standar yang diajarkan di sekolah) dan cara TERCEPAT (trik / shortcut / pola yang bikin cepet).

${TONE}

ATURAN PENTING:
- judul: maks 4 kata, catchy. Contoh: "Pisah puluhan & satuan", "Kali silang cepat", "Balik operasinya"
- cara_biasa: 2-3 langkah konkret. Cara yang diajarkan guru — jelas, runut, pasti benar.
- cara_tercepat: 2-3 langkah. Shortcut, trik mental, atau pola yang bikin hitung jauh lebih cepat. KALAU MEMANG ADA shortcutnya. Kalau soalnya simpel dan nggak ada trik khusus, kasih alternatif cara berpikir yang beda sudut pandang — jangan ulangi cara biasa.
- Setiap langkah: 1 kalimat pendek, bahasa santai Jakarta.
- JANGAN cuma bilang "hitung seperti biasa" — kasih langkah KONKRET dengan angkanya.
- JANGAN sebut "kamu salah" atau menggurui — user udah tau dia salah.`,
      { soal: problem.text, jawaban: problem.answer, tingkat: g.level },
      '{"judul_biasa":"...","cara_biasa":["...","...","..."],"judul_tercepat":"...","cara_tercepat":["...","...","..."]}',
      { timeout: 10_000, maxTokens: 1024 },
    )
    const tips = [
      { title: str(out.judul_biasa, 24) || 'Cara biasa', steps: (out.cara_biasa || []).map((s) => str(s, 120)).filter(Boolean).slice(0, 3) },
      { title: str(out.judul_tercepat, 24) || 'Cara tercepat', steps: (out.cara_tercepat || []).map((s) => str(s, 120)).filter(Boolean).slice(0, 3) },
    ].filter((t) => t.steps.length > 0)
    return { tips: tips.length === 2 ? tips : null, explanation: tips.length === 2 ? tips.map((t) => `${t.title}: ${t.steps.join(' ')}`).join(' | ') : '' }
  } catch (e) { return { tips: null, explanation: '', error: String(e.message).slice(0, 160) } }
}

// ── Challenge problem generation — AI penuh ──────────────────────────────────
// Generate soal matematika yang variatif, menantang, dan tidak monoton.
// AI menghasilkan soal dari nol: teks cerita, teka-teki, hitung cepat, dll.
const DOMAIN_INFO = {
  add: { name: 'penjumlahan', op: '+', icon: 'ph:plus-circle-fill' },
  sub: { name: 'pengurangan', op: '−', icon: 'ph:minus-circle-fill' },
  mul: { name: 'perkalian', op: '×', icon: 'ph:x-circle-fill' },
  div: { name: 'pembagian', op: ':', icon: 'ph:divide-fill' },
  ns:  { name: 'pemahaman angka', op: null, icon: 'ph:number-circle-one-fill' },
  est: { name: 'estimasi & pembulatan', op: null, icon: 'ph:target-fill' },
  frac:{ name: 'pecahan & desimal', op: null, icon: 'ph:percent-fill' },
  mix: { name: 'campuran', op: null, icon: 'ph:circles-three-plus-fill' },
  logic:{ name: 'logika & pola', op: null, icon: 'ph:brain-fill' },
}

const LEVEL_GUIDE = {
  easy: 'Angka kecil (1-99), satu langkah, operasi dasar. Jawaban 1-99.',
  mid:  'Angka menengah (10-999), bisa dua langkah ringan, pecahan simpel (½,¼), desimal. Jawaban 1-999.',
  adv:  'Angka besar (100-9999), multi-langkah, perbandingan, pola kompleks, logika. Jawaban 1-9999.',
}

const CONTEXT_POOL = [
  'game RPG (level-up, damage, HP, loot)', 'kuliner (resep, porsi, harga)', 'olahraga (skor, statistik)',
  'musik (streaming, playlist)', 'teknologi (coding, gadget, battery)', 'travel (jarak, tiket, waktu)',
  'dunia misteri (detektif, kode rahasia)', 'bisnis (jualan, diskon, untung)', 'alam (hewan, planet, cuaca)',
  'sci-fi (alien, roket, dimensi paralel)', 'sekolah kocak (nilai, PR, ekskul)', 'esport (turnamen, rank, skin)',
]

async function challengeProblemsHandler(count, level, domain) {
  if (!KEY) return { problems: null, error: 'AI_KEY belum diatur' }

  const domainList = domain ? [domain] : ['add', 'sub', 'mul', 'div', 'ns', 'est', 'logic', 'logic']
  const shuffled = domainList.sort(() => Math.random() - 0.5)
  const picked = []

  // Rotasi domain + format biar tiap soal beda rasa
  for (let i = 0; i < count; i++) {
    const d = shuffled[i % shuffled.length]
    const info = DOMAIN_INFO[d] || DOMAIN_INFO.add
    picked.push({ i, domain: d, domainName: info.name, op: info.op, icon: info.icon })
  }

  try {
    const out = await chat(
      `Kamu DESAINER QUEST di game RPG matematika bernama "NumQuest". Bikin soal yang bikin pemain GRINDING karena SERU — bukan PR matematika membosankan.

${TONE}

🎯 LEVEL: ${LEVEL_NAME[level]}
${LEVEL_GUIDE[level]}
${domain ? `🎯 FOKUS: ${DOMAIN_INFO[domain]?.name || domain}.` : `🎯 Domain rotasi: ${domainList.map((d) => DOMAIN_INFO[d]?.name).join(', ')}.`}

📚 KONTEKS WAJIB BERVARIASI (pilih dari daftar ini, JANGAN ulangi):
${CONTEXT_POOL.join(' | ')}

━━━ FORMAT SOAL (ROTASI KETAT — jangan dua tipe sama berturut!) ━━━

🔢 HITUNG KREATIF:
1. STORY — Cerita mini 2 kalimat seru (pilih konteks dari daftar atas!), akhiri pertanyaan hitung. BUKAN cuma "Andi beli X, Budi beli Y."
2. PUZZLE — Tebak angka: "Aku mikirin angka. Operasi rahasia → hasilnya segini. Cari angkanya!" Bikin pemain gregetan.
3. QUICK — Hitung naratif pendek & catchy. Twist menarik: diskon dobel, combo multiplier, crit damage, buff stacking.
4. COMPARE — "Mana lebih gede?" Bandingkan dua ekspresi dengan TWIST: kadang yang keliatan kecil ternyata gede.
5. MISSING — Cari angka/operasi hilang dalam persamaan. Bisa satu atau dua simbol hilang.
6. ESTIMATE — Perkirakan! Kasih 4 pilihan. Jangan terlalu gampang ditebak — selisih pilihan jangan terlalu jauh.

🧠 LOGIKA & POLA (MINIMAL 35% soal):
7. PATTERN — Lanjutkan pola: aritmetika, geometri, Fibonacci, kuadrat, segitiga, pola jam, pola alfabet. JANGAN cuma "2,4,6,8,?" — itu terlalu gampang.
8. DEDUCTION — Logika posisi/urutan/perbandingan. "Siapa di mana?" Jawaban = nomor posisi (1,2,3,dst).
9. VARIABLE — Trace kode: "x=3, y=7. x=x+y, y=x-y, x=x-y. Berapa nilai akhir x?" — ala swap variable programming.
10. CONDITIONAL — If-then logic: "N=12. Jika N genap→N/2, jika ganjil→N×3+1. Ulangi 3x. Hasil?" — ala Collatz.
11. CRYPTARITHM — Huruf=gambar digit: "AB + BA = 88, A>B. Berapa A×B?" atau "AA + BB = CC." Coba-coba logis.
12. LATERAL — Puzzle mikir miring: "1=3, 2=3, 3=5, 4=4, 5=4, 6=?" (hitung huruf: enam=4). Atau jam tangan, atau korek api.
13. GRID — Logika tabel: "3-4 orang, 3-4 atribut. Beberapa clue. Siapa/skor berapa?" Jawaban HARUS angka.

⚡ ATURAN KETAT:
- SETIAP soal formatnya HARUS BEDA. Jangan sampai dua soal STORY berturut-turut.
- Minimal 35% soal dari tipe LOGIKA & POLA (format 7-13). Pemain suka mikir!
- KONTEKS dari daftar di atas, maksimal 2 soal pakai konteks yang sama.
- JAWABAN harus angka bulat positif (1-9999). Periksa ulang — jangan sampai salah hitung!
- Jawaban JANGAN semua kecil (<50) atau semua besar (>500). Variasikan rentang jawabannya.
- Soal bikin PENSARAN — pemain harus mikir "wah cerdas juga nih soal."
- Bahasa santai Jakarta, natural, GAUL tapi bukan alay. Maks 30 kata.
- Kalau teks mengandung pilihan (format 6/12/13), sebutkan pilihannya di teks.`,
      { jumlah: count, tingkat: level, domain, daftar: picked.map((p, i) => ({ index: i, domain: p.domainName, operasi: p.op, wajibFormat: ['story', 'puzzle', 'quick', 'compare', 'missing', 'estimate', 'pattern', 'deduction', 'variable', 'conditional', 'cryptarithm', 'lateral', 'grid'][i % 13] })) },
      `{"soal":[{"domain":"add","teks":"...","jawaban":42,"ikon":"ph:plus-circle-fill"}]}`,
      { timeout: 30_000, maxTokens: 4096 },
    )

    const problems = (out.soal || []).map((item, idx) => {
      const p = picked[idx] || picked[0] || { domain: 'add', icon: 'ph:plus-circle-fill' }
      const answer = Number(item.jawaban)
      if (!item.teks || !Number.isFinite(answer)) return null
      return {
        key: `ai-challenge:${idx}:${Date.now()}`,
        text: str(item.teks, 200),
        answer,
        skill: `ai-${p.domain || 'add'}`,
        domain: item.domain && DOMAINS[item.domain] ? item.domain : p.domain,
        variant: 'word',
        icon: item.ikon || p.icon || 'ph:plus-circle-fill',
      }
    }).filter(Boolean)

    return { problems: problems.length >= 3 ? problems : null }
  } catch (e) {
    return { problems: null, error: String(e.message).slice(0, 160) }
  }
}

// ── Ultimate problem generation — 80% visual/spasial ────────────────────────
// Panelis AI khusus Ultimate Mode. BUKAN soal hitung biasa — fokus ke
// lateral thinking, logika pemrograman, creative thinking, dan problem solving.
// 80% soal melibatkan elemen visual/spasial/posisional.
const ULTIMATE_FORMATS = [
  'pattern',      // Pola visual/angka — lanjutkan urutan (2D, rotasi, geometris)
  'rotation',     // Rotasi & refleksi — kubus, bangun datar, bayangan cermin
  'grid',         // Grid & matriks — tabel 2D/3D, sudoku mini, magic square
  'variable',     // Trace variabel ala programming — loop, swap, rekursi ringan
  'deduction',    // Deduksi visual — posisi duduk, denah, susunan, urutan
  'lateral',      // Lateral thinking — puzzle insight, hitung huruf, jam, paradoks
  'cryptovisual', // Kripto visual — simbol/gambar ganti angka, sistem persamaan
  'conditional',  // Logika programmer — if-else, state machine, Collatz-like
  'spatial',      // Spasial murni — bayangan 3D, jarak, koordinat, arah mata angin
  'transform',    // Transformasi — scaling, mapping, encoding sederhana
]

const ULTIMATE_LEVEL_GUIDE = {
  easy: `Angka kecil (1-30). Satu langkah deduksi. Visual sederhana: grid 2×2 atau 3×3, pola segitiga/lingkaran, rotasi 1 langkah, deduksi 3-4 posisi. Pemula harus BISA menyelesaikan sambil belajar.`,
  mid:  `Angka menengah (1-100). Dua langkah. Visual: grid 3×3 atau 4×4, rotasi 2 langkah, deduksi 4-5 posisi, variabel swapping, kripto 2-3 variabel.`,
  adv:  `Angka besar (1-999). Multi-langkah (3-4). Visual: grid 4×4+, rotasi & refleksi majemuk, nested logic, transformasi berantai, Collatz-like branching, kripto 4+ variabel.`,
}

async function ultimateProblemsHandler(count, level, lang) {
  if (!KEY) return { problems: null, error: 'AI_KEY belum diatur' }

  const langRule = LANG_RULE[lang] || LANG_RULE.id

  // Rotasi format — 80% visual, 20% logic murni
  const visualFormats = ['pattern', 'rotation', 'grid', 'deduction', 'cryptovisual', 'spatial', 'transform']
  const logicFormats = ['variable', 'lateral', 'conditional']
  const picked = []
  for (let i = 0; i < count; i++) {
    // 80% visual, 20% logic — setiap 5 soal: 4 visual, 1 logic
    const pool = i % 5 < 4 ? visualFormats : logicFormats
    picked.push(pool[i % pool.length])
  }
  // Shuffle supaya tidak monoton
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]]
  }

  try {
    const out = await chat(
      `Kamu adalah PANELIS UTAMA "Ultimate Mode" di game NumQuest — mode PALING BERGENGsi yang menguji OTAK, bukan cuma jari hitung.

Kamu BUKAN generator soal matematika biasa. Kamu merancang TEKA-TEKI VISUAL & LOGIKA yang bikin pemain berhenti sejenak, mikir, lalu TERSENYUM karena "OH IYA!".

${TONE}

🎯 TINGKAT: ${LEVEL_NAME[level]}
${ULTIMATE_LEVEL_GUIDE[level]}

━━━ BAHASA — SEDERHANA & AKRAB ━━━
🗣️ SETIAP soal pakai BAHASA SEHARI-HARI — kayak ngobrol ke teman di kafe. BUKAN bahasa buku pelajaran.
🫧 SELIPKAN ANALOGI di minimal 50% soal. Pake benda/kejadian sehari-hari supaya konsep abstrak jadi gampang kebayang:
   • Game: level-up, inventory slot, combo, HP/MP, skin, rank, loot box
   • Masak & jajan: resep, porsi, antrean, diskon, meja kafe, topping
   • Olahraga: skor, klasemen, lapangan, formasi pemain, putaran lap
   • Musik & art: playlist, pixel art, pola drum, tangga nada, filter foto
   • Travel: rute, halte, kompas, baris kursi, denah mal, tangga, lift
   • Alam & sci-fi: sarang lebah, orbit planet, puzzle alien, kode rahasia
📝 Tiap soal maks 30 kata — pendek, jelas, ngena. JANGAN bertele-tele.
❌ JANGAN pakai: "jika", "maka", "tentukan", "hitunglah", "berapakah" — ganti dengan: "cari", "ada berapa", "tebak", "di mana", "berapa ya"

━━━ KOMPOSISI WAJIB ━━━
📐 80% soal VISUAL/SPASIAL — pemain harus MEMBAYANGKAN bentuk, posisi, rotasi, grid, atau susunan.
🧠 20% soal LOGIKA MURNI — lateral thinking, trace variabel, puzzle kata-angka.

━━━ FORMAT SOAL (WAJIB ROTASI — jangan 2 format sama berturut!) ━━━

📐 FORMAT VISUAL (80%):
1. PATTERN — Contoh pakai analogi: "Nada musik: do-re-mi-fa-sol-la-ti-do. Tangga nada ke-9?" Atau "Level game: 1→2→4→8→? (XP naik 2× tiap level). Level 5 butuh berapa XP?" Atau "Susunan bata: 1, 4, 9, 16, ? (jumlah bata buat piramida segi-n). Lapis ke-5?"
2. ROTATION — Contoh pakai analogi: "Kompas di HP: hadap utara. Layar diputar 90° kanan 3×. Sekarang hadap mana?" Atau "Dadu di papan ular tangga: sisi atas=3, depan=1. Dilempar ke kanan 1×. Sisi atas sekarang?" Atau "Kamera selfie diputar: depan→bawah→belakang→atas→? Mana selanjutnya?"
3. GRID — Contoh pakai analogi: "Denah tempat duduk 3×3 di bioskop. Baris 1: kursi 1,3,5. Baris 2: kursi 2,4,6. Baris 3: 3,?,9. Ada pola?" Atau "Stiker dikoleksi di album 3×3. Halaman 1 isi 3, halaman 2 isi 6. Satu album penuh isi berapa?"
4. DEDUCTION — Contoh pakai analogi: "Antrean di kafe: Andi di antara Budi & Citra. Dodi paling belakang. Eka tepat di depan Budi. Siapa antrean ke-2?" Atau "Parkiran: 5 motor sejajar. Motor merah di antara biru & hitam. Motor putih di ujung. Motor hijau di kanan merah. Urutan dari kiri?"
5. CRYPTOVISUAL — Contoh pakai analogi: "Di toko buah: 🍎+🍎+🍊=15. 🍎=4. Satu 🍊 harganya berapa?" Atau "Menu combo: 🍔+🥤=12, 🍔×🥤=32, 🍔>🥤. Harga 🍔−🥤?"
6. SPATIAL — Contoh pakai analogi: "Kamu di lantai 3 mal. Naik 5 lantai, turun 2, naik 1. Sampai lantai berapa?" Atau "Titik kumpul di tengah lapangan. Dari gawang (ujung kiri) ke titik kumpul = 25 langkah. Gawang ke gawang?"
7. TRANSFORM — Contoh pakai analogi: "Filter resize: foto 4×6 jadi 3× lebih gede. Ukuran baru?" Atau "Kode redeem game: A=1 s/d Z=26. Kode 'ACE' = 1+3+5 = 9. Kode 'BAG' = ?"

🧠 FORMAT LOGIKA (20%):
8. VARIABLE — Contoh pakai analogi: "Game RPG: HP awal=10. Kena buff +5, lalu heal 2× HP sekarang. HP akhir?" Atau "Koin di 2 kantong ditukar: kiri=7, kanan=4. Pindah semua kiri ke kanan, lalu kanan kasih 3 ke kiri. Isi kiri sekarang?"
9. LATERAL — Contoh pakai analogi: "Satu lusin telur = 12. Setengah lusin = 6. Dua lusin = ?" (ini gampang!). Atau "Kalender: bulan 1=31, bulan 2=28, bulan 3=31, bulan 4=? (hari)" Atau "Timbangan: 1 bata = 3kg + setengah bata. 1 bata berapa kg?"
10. CONDITIONAL — Contoh pakai analogi: "XP game: 100 XP. Kalau >50→XP/2, kalau ≤50→XP+20. Iterasi 2×. XP akhir?" Atau "Mode HP: silent→getar→ring→silent. Mulai getar, pencet 5×. Mode sekarang? (1=silent, 2=getar, 3=ring)"

⚠️ ATURAN KETAT — JANGAN DILANGGAR:
- SETIAP soal formatnya HARUS UNIK. ${picked.slice(0, 5).map((f, i) => `Soal ${i + 1} wajib format "${f}"`).join('. ')}. Lanjutkan rotasi.
- 80% soal HARUS VISUAL/SPASIAL — melibatkan posisi, rotasi, grid, susunan, bayangan. JANGAN cuma soal cerita hitung.
- MINIMAL 50% soal harus punya ANALOGI sehari-hari (game, masak, olahraga, traveling, dll). Jangan cuma angka telanjang!
- JAWABAN HARUS ANGKA BULAT POSITIF (1-9999). Periksa 2× sebelum menjawab — jangan sampai salah!
- JANGAN gunakan format: story, quick, compare, missing, estimate — itu soal Challenge mode, BUKAN Ultimate.
- Bahasa SANTUN & GAUL (santai Jakarta), BUKAN bahasa textbook. Kayak ngomong ke temen.
- ${langRule} Maks 30 kata per soal. Singkat tapi ngena.
- Variasikan rentang jawaban. Jangan semua jawaban <20 atau semua >500.`,
      { jumlah: count, tingkat: level, rotasi: picked.map((f, i) => ({ index: i, format: f })) },
      `{"soal":[{"format":"pattern","domain":"logic","teks":"...","jawaban":42,"ikon":"ph:shapes-fill"}]}`,
      { timeout: 35_000, maxTokens: 4096 },
    )

    const problems = (out.soal || []).map((item, idx) => {
      const answer = Number(item.jawaban)
      if (!item.teks || !Number.isFinite(answer)) return null
      const fmt = item.format || picked[idx] || 'pattern'
      const domain = item.domain && DOMAINS[item.domain] ? item.domain : 'logic'
      return {
        key: `ultimate:${level}:${idx}:${Date.now()}`,
        text: str(item.teks, 220),
        answer,
        skill: `ultimate-${fmt}`,
        domain,
        variant: 'word',
        icon: item.ikon || 'ph:brain-fill',
        _fmt: fmt,
      }
    }).filter(Boolean)

    return { problems: problems.length >= 3 ? problems : null }
  } catch (e) {
    return { problems: null, error: String(e.message).slice(0, 160) }
  }
}

// ── Router ──────────────────────────────────────────────────────────────────
const ROUTES = {
  'GET /lessons': async (q) => {
    const level = ['easy', 'mid', 'adv'].includes(q.level) ? q.level : 'easy'
    const lang = q.lang === 'en' ? 'en' : 'id'
    return lessonsHandler(level, lang)
  },
  'POST /learn/chat': async (_q, body) => {
    const msg = String(body.message || '').trim().slice(0, 500)
    if (!msg) throw new Error('Pesan kosong')
    const topic = String(body.topic || '').slice(0, 200)
    const history = (Array.isArray(body.history) ? body.history : []).slice(-4)
      .map((h) => ({ role: h?.role === 'ai' ? 'ai' : 'user', text: String(h?.text || '').slice(0, 300) }))
    const g = parseState(body)
    const lang = body.lang === 'en' ? 'en' : 'id'
    return learnChatHandler(g, msg, topic, history, lang)
  },
  'GET /coach': async (_q, body) => coachHandler(parseState(body)),
  'GET /quests': async (_q, body) => ({ quests: await questsHandler(parseState(body), today()) }),
  'GET /challenge': async (_q, body) => challengeHandler(parseState(body), today()),
  'POST /problem/flavor': async (_q, body) => {
    const problems = Array.isArray(body.problems) ? body.problems.slice(0, 20) : []
    return flavorHandler(problems, parseState(body))
  },
  'POST /problem/explain': async (_q, body) => {
    const p = body.problem || {}
    if (typeof p.text !== 'string') throw new Error('problem.text wajib diisi')
    return explainHandler(p, parseState(body))
  },
  'POST /problem/challenge': async (_q, body) => {
    const count = num(body.count, 5, 30, 12)
    const level = ['easy', 'mid', 'adv'].includes(body.level) ? body.level : 'easy'
    const domain = body.domain && DOMAINS[body.domain] ? body.domain : null
    return challengeProblemsHandler(count, level, domain)
  },
  'POST /problem/ultimate': async (_q, body) => {
    const count = num(body.count, 3, 15, 7)
    const level = ['easy', 'mid', 'adv'].includes(body.level) ? body.level : 'easy'
    const lang = body.lang === 'en' ? 'en' : 'id'
    return ultimateProblemsHandler(count, level, lang)
  },
}

// ── Entry point ─────────────────────────────────────────────────────────────
export default async function handler(req, context) {
  // Netlify rewrite dari /api/* → gunakan rawUrl supaya path asli tetap terbaca
  const raw = (context?.rawUrl || req.url)
  const url = new URL(raw.startsWith('http') ? raw : `http://localhost${raw}`)
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/^\/\.netlify\/functions\/api\/?/, '')
  const key = `${req.method} /${path}`

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      },
    })
  }

  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  }

  try {
    // Health check — dipakai klien untuk cek apakah AI tersedia
    if (path === 'health') {
      return new Response(JSON.stringify({ aiReady: !!KEY }), { status: 200, headers })
    }

    if (!KEY) {
      return new Response(JSON.stringify({ error: 'AI_KEY belum diatur di server', aiReady: false }), { status: 503, headers })
    }

    const route = ROUTES[key]
    if (!route) {
      return new Response(JSON.stringify({ error: `Rute tidak ditemukan: ${key}` }), { status: 404, headers })
    }

    const body = req.method === 'GET' ? {} : await req.json().catch(() => ({}))
    const query = Object.fromEntries(url.searchParams)
    const data = await route(query, body)
    return new Response(JSON.stringify(data), { status: 200, headers })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message).slice(0, 200) }), { status: 500, headers })
  }
}
