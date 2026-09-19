// Generate sprite monster Jalur AI pakai Gemini 2.5 Flash Image ("nano banana").
//
// Pakai:
//   1. tambahin ke .env:  GEMINI_API_KEY=xxxx
//   2. node --env-file=.env scripts/gen-monsters.mjs
//
// Hasilnya PNG transparan di src/assets/monsters/<id>-<state>.png
// Catatan: model ini bikin GAMBAR DIAM. Animasinya tetap dari CSS transform
// (mon--idle / mon--roar / mon--hurt di styles.css), persis kayak sprite game 2D.
import { writeFile, mkdir } from 'node:fs/promises'
import { AI_PATH } from '../src/aiPath.js'
import { CATEGORIES, catByIndex } from '../src/aiPath.js'

const KEY = process.env.GEMINI_API_KEY
const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image'
const OUT = new URL('../src/assets/monsters/', import.meta.url)

if (!KEY) {
  console.error('GEMINI_API_KEY belum diisi di .env — script berhenti.')
  process.exit(1)
}

// Arahan seni: Attack on Titan inspired titans — dark, grotesque, menacing.
// Bukan cute, bukan playful. Menakutkan tapi tetap readable sebagai sprite game.
const STYLE = [
  'dark anime aesthetic inspired by Attack on Titan titans,',
  'grotesque muscular body, exaggerated proportions, unsettling organic forms,',
  'thick heavy outlines, high contrast values, menacing expression,',
  'body horror elements, asymmetrical design, intelligent malevolent creature,',
  'vector illustration, bold dramatic lighting, matte flat colors,',
  'centered full body front view, transparent background, no text, no shadow,',
  'game sprite 1:1 square, crisp edges, dark color palette',
].join(' ')

const STATES = {
  idle:     'standing imposingly, shoulders tensed, jaw clenched, breathing heavily, predatory gaze fixed forward',
  roar:     'mid-roar with mouth grotesquely wide, muscles bulging with fury, arms raised menacingly, primordial scream',
  defeated: 'collapsed, twitching, eyes rolled back or blank, grotesque posture, wounded and breaking down',
}

async function gen(prompt) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  )
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  const json = await res.json()
  const part = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)
  if (!part) throw new Error('model nggak balikin gambar: ' + JSON.stringify(json).slice(0, 300))
  return Buffer.from(part.inlineData.data, 'base64')
}

await mkdir(OUT, { recursive: true })

// Deskripsi monster per node — inspired by AoT titan archetypes
const ARCHETYPES = {
  'kenalan-angka': 'colossal brute titan with disproportionate jaw, obsessed with counting and consumption',
  'pembulatan': 'abnormal titan with asymmetrical features, one eye larger than the other, calculating gaze',
  'sehari-hari': 'armored-like titan with segmented body plates, hulking and relentless',
  'tambah-kurang': 'wiry aggressive titan with long limbs and sharp angular features, restless energy',
  'kali-bagi': 'beast-like titan with feline traits, predatory and strategic',
  'desimal': 'intelligent shifter-class titan with refined malevolent features, deliberate movements',
  'pecahan': 'fragmented titan with cracked, crystalline body sections, unstable and dangerous',
  'persen': 'corrupted titan wreathed in aura, fractured consciousness visible in expression',
  'logika-cond': 'sleek predatory titan, laser-focused gaze, minimalist threatening form',
  'logika-loop': 'cyclopean titan endlessly restless, repetitive aggressive posture',
  'logika-func': 'modular titan with hierarchical body segments, cold calculated menace',
  'logika-array': 'swarm-leader titan with multiple focal points, overwhelming presence',
  'logika-order': 'disciplined military titan, scarred and battle-hardened appearance',
  'logika-var': 'shapeshifting appearance titan, morphing unstable form, unpredictable',
  'logika-mesin': 'mechanical hybrid titan, gears and organic matter fused, utterly alien',
}

for (const [i, node] of AI_PATH.entries()) {
  const color = catByIndex[i]?.color || '#f4b942'
  const archetype = ARCHETYPES[node.id] || `mysterious titan entity embodying "${node.title}"`

  for (const [state, pose] of Object.entries(STATES)) {
    const prompt = [
      `An Attack on Titan style titan monster: ${archetype}.`,
      `${pose}.`,
      `Primary color ${color}, secondary dark grey/black shadows.`,
      STYLE
    ].join(' ')

    try {
      const png = await gen(prompt)
      const file = new URL(`${node.id}-${state}.png`, OUT)
      await writeFile(file, png)
      console.log('ok  ', `${node.id}-${state}.png`, `${(png.length / 1024) | 0}kb`)
    } catch (e) {
      console.error('gagal', `${node.id}-${state}`, e.message)
    }
  }
}

console.log(`\nselesai — cek src/assets/monsters/`)
