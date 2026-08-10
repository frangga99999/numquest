// Panggilan model dilakukan di sini — kunci API tidak pernah meninggalkan server.
// Semua keluaran model divalidasi ulang terhadap mesin lokal sebelum dipakai.

import { skillsOf, levelStatus, nextLevel, DOMAINS, VARIANT_NAME } from '../src/engine.js'
import { snapshot, localCoach } from '../src/coach.js'
import { localQuests, localChallenge, CHALLENGE_MODS } from '../src/quests.js'

const KEY = process.env.AI_KEY
const BASE = process.env.AI_BASE || 'https://api.openai.com/v1'
const MODEL = process.env.AI_MODEL || 'gpt-4o-mini'

const TONE = `Kamu pelatih aritmatika untuk orang dewasa 25-40 tahun yang kesulitan berhitung (diskalkulia / trauma matematika).
Bahasa: hangat, singkat, bahasa Indonesia sehari-hari. Dilarang: kata "salah/gagal/bodoh/mudah sekali", istilah klinis, membandingkan dengan orang lain, dan tanda seru berlebihan.
Sebut angka nyata dari data yang diberikan. Jangan mengarang data.`

async function chat(system, user, schemaHint, { timeout = 12_000, maxTokens } = {}) {
  if (!KEY) throw new Error('AI_KEY belum diatur')
  const ctrl = new AbortController()
  // Batas waktu per-panggilan: menyusun 6 materi jauh lebih lama daripada
  // menjawab satu chat, dan 12 detik untuk semuanya bikin materi selalu gagal.
  const timer = setTimeout(() => ctrl.abort(), timeout)
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
          { role: 'system', content: `${TONE}\n${system}\nBalas HANYA JSON: ${schemaHint}` },
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

// Potong di batas kata — kalimat yang terputus di tengah kata terbaca seperti aplikasi rusak.
function str(v, max = 240) {
  const s = String(v ?? '').trim()
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const sp = cut.lastIndexOf(' ')
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[ ,;:-]+$/, '') + '…'
}

// --------------------------- Pelatih harian ---------------------------------
export async function coach(g) {
  const base = localCoach(g)
  try {
    const out = await chat(
      `Pilih maksimal 3 skill fokus hari ini dari daftar, tulis satu pesan (maks 2 kalimat), nilai kesiapan naik tingkat, dan tentukan jumlah soal sesi (10–15).
Gaya bahasa: santai dan gaul ala obrolan sehari-hari orang Jakarta — pakai kata seperti "yuk", "gas", "nih", "santai", "banget". Hindari bahasa baku/formal seperti "Anda" atau "silakan".
Syarat naik tingkat: ketepatan >= 85%, minimal 70% skill emas, dan hari latihan >= minimal_hari.
Jumlah soal: 10 jika akurasi < 60% atau baru mulai, 12 jika akurasi 60–79%, 15 jika akurasi >= 80% dan konsisten.`,
      snapshot(g),
      '{"focus":["skill-id"],"message":"...","canAdvance":true|false,"advice":"...","sessionCount":12}',
    )
    const valid = new Set(skillsOf(g.level).map((s) => s.id))
    const st = levelStatus(g)
    const focus = (out.focus || []).filter((f) => valid.has(f)).slice(0, 3)
    const rawCount = Number(out.sessionCount)
    const sessionCount = Number.isFinite(rawCount) ? Math.min(15, Math.max(10, Math.round(rawCount))) : 12
    return {
      ...base,
      focus: focus.length ? focus : base.focus,
      message: str(out.message) || base.message,
      advice: str(out.advice) || base.advice,
      sessionCount,
      // pengaman: model tidak boleh meloloskan kenaikan yang belum memenuhi ambang terukur
      canAdvance: !!out.canAdvance && st.ready && !!nextLevel(g.level),
      source: 'ai',
    }
  } catch (e) {
    return { ...base, error: String(e.message).slice(0, 160) }
  }
}

// --------------------------- Tugas harian -----------------------------------
// Model memilih jenis + takaran + judulnya; targetnya tetap dijepit ke rentang
// yang masuk akal supaya tidak pernah keluar tugas yang mustahil diselesaikan.
export async function quests(g, daySeed) {
  const base = localQuests(g, daySeed)
  try {
    const out = await chat(
      `Susun 3 tugas harian yang berbeda dari kemarin. Jenis yang tersedia:
${Object.entries({ problems: 'jumlah soal dikerjakan', correct: 'jumlah jawaban benar', fast: 'jawaban benar di bawah 3 detik', combo: 'jawaban benar beruntun', minutes: 'menit latihan', domain: 'jawaban benar di satu wilayah (param = id wilayah)', variant: 'jawaban benar pada satu bentuk soal (param = gap|tf|cmp)' })
        .map(([k, v]) => `- ${k}: ${v}`).join('\n')}
Wilayah yang ada: ${Object.entries(DOMAINS).map(([id, d]) => `${id} (${d.name})`).join(', ')}.
Bentuk soal: ${Object.entries(VARIANT_NAME).map(([k, v]) => `${k} (${v})`).join(', ')}.
Di judul dan keterangan, pakai nama Indonesia untuk wilayah dan bentuk soal — jangan pernah tulis id-nya seperti "gap", "tf", atau "sub".
Gaya bahasa santai ala obrolan Jakarta sehari-hari, bukan bahasa baku/formal.
PENTING: kind "correct", "domain", dan "variant" hanya menghitung jawaban yang BENAR — judul dan keterangannya harus menyebut "benar", jangan "selesaikan" atau "kerjakan".
Kind "problems" menghitung semua soal yang dikerjakan, benar maupun belum.
Takaran harus bisa diselesaikan dalam ${g.goalMin}–${g.goalMin * 2} menit. Judul maksimal 8 kata.`,
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
          id: `${q.kind}-${i}`,
          kind: q.kind,
          param: q.param,
          target: Math.min(cap[1], Math.max(cap[0], Math.round(Number(q.target) || cap[0]))),
          title: str(q.title, 70) || fallback.title,
          desc: str(q.desc, 120) || fallback.desc,
          reward: fallback.reward,
        }
      })
    return picked.length === 3 ? picked : base
  } catch {
    return base
  }
}

// --------------------------- Tantangan bertema ------------------------------
// Mekaniknya tetap lokal (bentuk soal + wilayah); model hanya memberi nama dan
// cerita hariannya, jadi tantangan terasa baru tanpa mengubah aturan main.
export async function challenge(g, daySeed) {
  const base = localChallenge(g, daySeed)
  try {
    const out = await chat(
      `Beri nama dan satu kalimat cerita untuk tantangan harian bertema kerajaan.
Mekaniknya sudah ditentukan: wilayah "${DOMAINS[base.domain].region}" (${DOMAINS[base.domain].name}), bentuk soal "${VARIANT_NAME[base.variantBias]}".
Gaya bahasa santai ala obrolan Jakarta sehari-hari, bukan bahasa baku. Nama maksimal 5 kata. Jangan menjanjikan hadiah apa pun.`,
      { wilayah: DOMAINS[base.domain], bentuk: VARIANT_NAME[base.variantBias], hari: daySeed % 7 },
      '{"title":"...","desc":"..."}',
    )
    return { ...base, title: str(out.title, 60) || base.title, desc: str(out.desc, 140) || base.desc, source: 'ai' }
  } catch {
    return base
  }
}

// --------------------------- Variasi soal (bungkus cerita) -------------------
// Mekanik & jawaban 100% dari mesin lokal — model CUMA mengarang kalimat baru
// di sekitar angka yang sama. Ini yang bikin soal terasa selalu beda tanpa
// pernah membuka celah jawaban keliru dari model.
export async function flavorProblems(problems, g) {
  const plain = problems.filter((p) => /=\s*\?$/.test(p.text))
  if (!plain.length) return {}
  try {
    const out = await chat(
      `Tulis ulang tiap soal hitung jadi kalimat cerita pendek yang seru dan bervariasi (konteks sehari-hari: jajan, main game, kerja, dll — beda-beda tiap soal, jangan bungkus yang sama berulang).
ATURAN KETAT: angka dan operasi (+ − × :) di tiap soal HARUS sama persis seperti aslinya — cuma bungkus ceritanya yang boleh berubah, bukan angkanya.
Sesuaikan kerumitan kalimat dengan tingkat "${g.level}" (dasar = kalimat pendek & sederhana). Gaya santai ala obrolan Jakarta sehari-hari.
Balas array dengan id dan panjang SAMA PERSIS seperti soal yang diberikan.`,
      { tingkat: g.level, soal: plain.map((p) => ({ id: p.key, teks: p.text })) },
      '{"soal":[{"id":"...","teks":"..."}]}',
    )
    const map = {}
    for (const item of out.soal || []) {
      const orig = plain.find((p) => p.key === item.id)
      if (!orig) continue
      const t = str(item.teks, 160)
      // jaga-jaga: kalau model kehilangan salah satu angka aslinya, buang variannya
      const nums = orig.text.match(/\d+(?:,\d+)?/g) || []
      if (t && nums.every((n) => t.includes(n))) map[item.id] = t
    }
    return map
  } catch {
    return {}
  }
}

// --------------------------- Tanya AI (bantuan langsung) --------------------
// Item koleksi terbatas — dipanggil sekali per pakai dari sesi saat user buntu.
// Jawaban akhirnya dikirim ke model supaya penjelasannya tidak pernah salah,
// model hanya menyusun jalan pikirannya.
export async function explainSimple(problem, g) {
  try {
    const out = await chat(
      `User lagi buntu di satu soal matematika. Jelaskan caranya SANGAT sederhana, kayak lagi ngejelasin ke teman yang baru belajar — 2-3 kalimat pendek, langkah demi langkah, bahasa santai sehari-hari ala Jakarta. Jangan langsung sebut jawaban akhirnya di kalimat pertama, tuntun dulu prosesnya.`,
      { soal: problem.text, jawaban: problem.answer, tingkat: g.level },
      '{"penjelasan":"..."}',
    )
    return { explanation: str(out.penjelasan, 220) }
  } catch (e) {
    return { explanation: '', error: String(e.message).slice(0, 160) }
  }
}

// --------------------------- Materi panduan ---------------------------------
// Materi DIKARANG model, termasuk visualnya — tapi model tidak menggambar apa
// pun. Dia cuma memilih salah satu bentuk visual di bawah dan mengisi angkanya;
// src/LessonVisual.jsx yang menggambar. Ini yang bikin materi baru selalu punya
// visual sungguhan, bukan kotak kosong karena nama gambarnya tak dikenal klien.
const VISUAL_SPEC = `Pilih SATU bentuk visual dan isi parameternya (angka kecil, mudah dicerna):
- {"kind":"items","a":3,"b":2,"op":"+","labelA":"punya","labelB":"dikasih","labelResult":"apel"}  → benda dihitung, op "+" atau "-"
- {"kind":"groups","g":3,"p":4}                       → g kelompok isi p (perkalian/pembagian). g 2-5, p 1-6
- {"kind":"pie","pies":[{"slices":4,"filled":1,"label":"seperempat"}]}  → pecahan, maks 3 lingkaran
- {"kind":"grid100","filled":25}                      → persen, 0-100 petak
- {"kind":"numberline","from":0,"to":20,"start":8,"jumps":[4]}  → garis bilangan, jumps boleh negatif
- {"kind":"bars","bars":[{"label":"Andi","value":3},{"label":"Budi","value":7}],"caption":"..."}  → perbandingan/rata-rata
- {"kind":"steps","boxes":[{"title":"Langkah 1","eq":"99 + 1 = 100","note":"bulatkan"}]}  → jurus hitung cepat, maks 3 kotak`

const VISUAL_KINDS = new Set(['items', 'groups', 'pie', 'grid100', 'numberline', 'bars', 'steps'])
const num = (v, lo, hi, dflt) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt
}

// Validasi ketat: model boleh salah, tapi klien tidak boleh dapat spec rusak.
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
// Materi ikut bahasa yang dipilih user — kalau tidak, halaman panduan jadi
// satu-satunya layar yang tetap berbahasa Indonesia saat mode English aktif.
const LANG_RULE = {
  id: 'Tulis SEMUA teks dalam bahasa Indonesia santai ala obrolan Jakarta sehari-hari.',
  en: 'Write ALL text in casual, friendly English. Keep sentences short and plain.',
}

export async function lessons(level = 'easy', lang = 'id') {
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
${LANG_RULE[lang] || LANG_RULE.id} Ini termasuk label di dalam "visual" (labelA, labelB, labelResult, label, title, note) — semuanya harus satu bahasa, jangan campur.
Dilarang: emoji, dan kata yang merendahkan seperti "mudah sekali" atau "gampang kok".
Buat 6 materi dengan domain yang BERBEDA-BEDA.`,
    { tingkat: level, bahasa: lang },
    '{"lessons":[{"title":"...","domain":"add","hook":"...","intro":"...","visual":{"kind":"..."},"steps":[{"eq":"...","text":"..."}],"tip":"...","analogy":"...","why":"..."}]}',
    { timeout: 90_000, maxTokens: 4000 },
  )

  const seen = new Set()
  return (out.lessons || []).map((l, i) => {
    const domain = DOMAINS[l.domain] ? l.domain : 'add'
    const visual = cleanVisual(l.visual)
    const steps = (Array.isArray(l.steps) ? l.steps : []).slice(0, 3)
      .map((s) => ({ eq: str(s?.eq, 24), text: str(s?.text, 110) })).filter((s) => s.text)
    const title = str(l.title, 34)
    if (!title || !visual || steps.length < 2) return null
    let id = `${domain}-${i}`
    while (seen.has(id)) id += 'x'
    seen.add(id)
    return {
      id, title, domain, level,
      content: {
        hook: str(l.hook, 120), intro: str(l.intro, 200), visual, steps,
        tip: str(l.tip, 140), analogy: str(l.analogy, 160), why: str(l.why, 140),
      },
    }
  }).filter(Boolean)
}

// --------------------------- Chat belajar ------------------------------------
// Mirip explainSimple tapi lebih leluasa — user bisa tanya apa saja tentang topik
// matematika yang sedang dipelajari. Jawaban tetap sederhana & visual.
// Sengaja TIDAK menelan galat: kalau sambungan ke model putus, itu harus
// kelihatan sebagai galat beneran — bukan kalimat "AI lagi istirahat" yang
// menyamar jadi jawaban dan bikin halaman terasa AI padahal tidak.
export async function learnChat(g, message, topic, history = [], lang = 'id') {
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
  }
}

export const configured = !!KEY
export { CHALLENGE_MODS }
