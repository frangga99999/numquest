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
async function chat(system, user, schemaHint, { timeout = 25_000, maxTokens } = {}) {
  if (!KEY) throw new Error('AI_KEY belum diatur')
  const ctrl = new AbortController()
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
  id: 'Tulis SEMUA teks dalam bahasa Indonesia santai ala obrolan Jakarta sehari-hari.',
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
      `Tulis ulang tiap soal hitung jadi kalimat cerita pendek yang seru dan bervariasi.
ATURAN KETAT: angka dan operasi (+ − × :) di tiap soal HARUS sama persis seperti aslinya.
Sesuaikan kerumitan kalimat dengan tingkat "${g.level}". Gaya santai Jakarta.
Balas array dengan id dan panjang SAMA PERSIS seperti soal yang diberikan.`,
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
async function explainHandler(problem, g) {
  try {
    const out = await chat(
      `User lagi buntu di satu soal matematika. Jelaskan caranya SANGAT sederhana, 2-3 kalimat pendek, langkah demi langkah, bahasa santai Jakarta. Jangan langsung sebut jawaban akhirnya di kalimat pertama.`,
      { soal: problem.text, jawaban: problem.answer, tingkat: g.level },
      '{"penjelasan":"..."}',
    )
    return { explanation: str(out.penjelasan, 220) }
  } catch (e) { return { explanation: '', error: String(e.message).slice(0, 160) } }
}

// ── Router ──────────────────────────────────────────────────────────────────
const ROUTES = {
  'GET /lessons': async (q) => {
    const level = ['easy', 'mid', 'adv'].includes(q.level) ? q.level : 'easy'
    const lang = q.lang === 'en' ? 'en' : 'id'
    return lessonsHandler(level, lang)
  },
  'POST /learn/chat': async (body) => {
    const msg = String(body.message || '').trim().slice(0, 500)
    if (!msg) throw new Error('Pesan kosong')
    const topic = String(body.topic || '').slice(0, 200)
    const history = (Array.isArray(body.history) ? body.history : []).slice(-4)
      .map((h) => ({ role: h?.role === 'ai' ? 'ai' : 'user', text: String(h?.text || '').slice(0, 300) }))
    const g = parseState(body)
    const lang = body.lang === 'en' ? 'en' : 'id'
    return learnChatHandler(g, msg, topic, history, lang)
  },
  'GET /coach': async (_, body) => coachHandler(parseState(body)),
  'GET /quests': async (_, body) => ({ quests: await questsHandler(parseState(body), today()) }),
  'GET /challenge': async (_, body) => challengeHandler(parseState(body), today()),
  'POST /problem/flavor': async (body) => {
    const problems = Array.isArray(body.problems) ? body.problems.slice(0, 20) : []
    return flavorHandler(problems, parseState(body))
  },
  'POST /problem/explain': async (body) => {
    const p = body.problem || {}
    if (typeof p.text !== 'string') throw new Error('problem.text wajib diisi')
    return explainHandler(p, parseState(body))
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
