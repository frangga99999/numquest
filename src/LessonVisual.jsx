import React from 'react'
import { motion } from 'framer-motion'

// Penggambar visual materi. AI cuma mengirim SPESIFIKASI (JSON), bukan gambar —
// komponen ini yang menggambarnya. Jadi setiap materi baru yang dikarang model
// tetap dapat visual sungguhan, bukan kotak kosong karena kuncinya tak dikenal.
//
// Bentuk yang didukung (lihat VISUAL_KINDS di server/ai.js — harus sinkron):
//   items      { a, b, op:'+'|'-', labelA, labelB, labelResult }
//   groups     { g, p }                       — g kelompok isi p
//   pie        { pies:[{slices, filled}] }    — pecahan
//   grid100    { filled }                     — persen
//   numberline { from, to, start, jumps:[..] }
//   bars       { bars:[{label, value}] }
//   steps      { boxes:[{title, eq, note}] }

const PALETTE = ['#f4b942', '#3ec98a', '#8d7bff', '#6bd5ff', '#ff9f6b', '#ff6b6b']
const clampInt = (v, lo, hi, dflt) => {
  const n = Math.round(Number(v))
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt
}
const pop = (i = 0) => ({
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1 },
  transition: { delay: i * 0.045, type: 'spring', stiffness: 420, damping: 18 },
})

/* ----------------------------- items: a ± b ------------------------------- */
function Items({ spec }) {
  const a = clampInt(spec.a, 1, 12, 3)
  const b = clampInt(spec.b, 1, 12, 2)
  const sub = spec.op === '-'
  const total = sub ? a : a + b
  const result = sub ? a - b : a + b
  const R = 13, GAP = 30
  const perRow = Math.min(total, 8)
  const rows = Math.ceil(total / perRow)
  const W = perRow * GAP + 20
  const H = rows * GAP + 62

  return (
    <svg viewBox={`0 0 ${Math.max(W, 250)} ${H}`} className="lv-svg">
      {Array.from({ length: total }).map((_, i) => {
        const row = Math.floor(i / perRow), col = i % perRow
        const cx = 20 + col * GAP, cy = 26 + row * GAP
        // penjumlahan: kelompok kedua beda warna. pengurangan: yang dicoret di akhir.
        const isSecond = sub ? i >= a - b : i >= a
        const gone = sub && isSecond
        return (
          <motion.g key={i} {...pop(i)}>
            <circle cx={cx} cy={cy} r={R}
              fill={gone ? 'rgba(255,255,255,.05)' : isSecond ? PALETTE[2] : PALETTE[0]}
              stroke={gone ? 'rgba(255,255,255,.18)' : 'none'}
              strokeDasharray={gone ? '3 2' : undefined} />
            {gone && (
              <>
                <line x1={cx - 7} y1={cy - 7} x2={cx + 7} y2={cy + 7} stroke="#ff6b6b" strokeWidth={2.5} strokeLinecap="round" />
                <line x1={cx + 7} y1={cy - 7} x2={cx - 7} y2={cy + 7} stroke="#ff6b6b" strokeWidth={2.5} strokeLinecap="round" />
              </>
            )}
          </motion.g>
        )
      })}
      <motion.text x={12} y={H - 30} fontSize={13} fill="var(--dim)" fontWeight="700"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        {spec.labelA || `${a}`} {sub ? '−' : '+'} {spec.labelB || `${b}`}
      </motion.text>
      <motion.text x={12} y={H - 10} fontSize={17} fill="var(--green)" fontWeight="900"
        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
        = {result} {spec.labelResult || ''}
      </motion.text>
    </svg>
  )
}

/* --------------------------- groups: g × p -------------------------------- */
function Groups({ spec }) {
  const g = clampInt(spec.g, 2, 5, 3)
  const p = clampInt(spec.p, 1, 6, 4)
  const BW = 74, GAP = 12
  const W = g * (BW + GAP) + 8
  return (
    <svg viewBox={`0 0 ${Math.max(W, 250)} 132`} className="lv-svg">
      {Array.from({ length: g }).map((_, gi) => {
        const x = 8 + gi * (BW + GAP)
        const c = PALETTE[gi % PALETTE.length]
        return (
          <motion.g key={gi} {...pop(gi * 2)}>
            <rect x={x} y={10} width={BW} height={82} rx={12} fill={`${c}14`} stroke={c} strokeWidth={2} strokeDasharray="6 4" />
            {Array.from({ length: p }).map((_, pi) => {
              const cols = Math.min(p, 3)
              const col = pi % cols, row = Math.floor(pi / cols)
              return <motion.circle key={pi} {...pop(gi * 2 + pi * 0.3)}
                cx={x + 18 + col * 20} cy={36 + row * 22} r={8} fill={c} />
            })}
            <text x={x + BW / 2} y={106} textAnchor="middle" fontSize={11} fill={c} fontWeight="800">×{p}</text>
          </motion.g>
        )
      })}
      <motion.text x={8} y={126} fontSize={14} fill="var(--gold)" fontWeight="800"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
        {g} × {p} = {g * p}
      </motion.text>
    </svg>
  )
}

/* ------------------------------ pie: pecahan ------------------------------ */
function Pies({ spec }) {
  const pies = (Array.isArray(spec.pies) && spec.pies.length ? spec.pies : [{ slices: 4, filled: 1 }]).slice(0, 3)
  const R = 40
  return (
    <svg viewBox={`0 0 ${pies.length * 108 + 8} 128`} className="lv-svg">
      {pies.map((pie, pi) => {
        const slices = clampInt(pie.slices, 1, 12, 4)
        const filled = clampInt(pie.filled, 0, slices, 1)
        const cx = 54 + pi * 108, cy = 52
        return (
          <motion.g key={pi} {...pop(pi * 3)}>
            {Array.from({ length: slices }).map((_, si) => {
              const a0 = (si / slices) * Math.PI * 2 - Math.PI / 2
              const a1 = ((si + 1) / slices) * Math.PI * 2 - Math.PI / 2
              const big = a1 - a0 > Math.PI ? 1 : 0
              const d = slices === 1
                ? `M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R} Z`
                : `M ${cx} ${cy} L ${cx + R * Math.cos(a0)} ${cy + R * Math.sin(a0)} A ${R} ${R} 0 ${big} 1 ${cx + R * Math.cos(a1)} ${cy + R * Math.sin(a1)} Z`
              return <motion.path key={si} d={d}
                fill={si < filled ? PALETTE[0] : 'rgba(255,255,255,.06)'}
                stroke="#0d1e30" strokeWidth={2}
                {...pop(pi * 3 + si * 0.25)} />
            })}
            <text x={cx} y={110} textAnchor="middle" fontSize={15} fill="var(--ink)" fontWeight="800">
              {filled}/{slices}
            </text>
            {pie.label && <text x={cx} y={124} textAnchor="middle" fontSize={9} fill="var(--dim)">{pie.label}</text>}
          </motion.g>
        )
      })}
    </svg>
  )
}

/* --------------------------- grid100: persen ------------------------------ */
function Grid100({ spec }) {
  const filled = clampInt(spec.filled, 0, 100, 25)
  return (
    <svg viewBox="0 0 250 150" className="lv-svg">
      {Array.from({ length: 100 }).map((_, i) => {
        const row = Math.floor(i / 10), col = i % 10
        const on = i < filled
        return (
          <motion.rect key={i} x={8 + col * 15} y={8 + row * 11} width={13} height={9} rx={2}
            fill={on ? PALETTE[0] : 'rgba(255,255,255,.07)'}
            stroke={on ? '#c08020' : 'rgba(255,255,255,.1)'} strokeWidth={1}
            initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.006, duration: 0.2 }} />
        )
      })}
      <text x={8} y={136} fontSize={16} fill="var(--gold)" fontWeight="900">{filled}%</text>
      <text x={56} y={136} fontSize={12} fill="var(--dim)" fontWeight="700">= {filled}/100</text>
      <text x={130} y={136} fontSize={12} fill="rgba(255,255,255,.35)" fontWeight="700">{100 - filled}/100</text>
    </svg>
  )
}

/* ---------------------------- numberline ---------------------------------- */
function NumberLine({ spec }) {
  const from = clampInt(spec.from, 0, 100, 0)
  const to = Math.max(from + 1, clampInt(spec.to, 1, 120, 20))
  const start = clampInt(spec.start, from, to, from)
  const jumps = (Array.isArray(spec.jumps) ? spec.jumps : [])
    .map((j) => clampInt(j, -50, 50, 0)).filter(Boolean).slice(0, 4)
  const W = 250, PAD = 16
  const x = (v) => PAD + ((v - from) / (to - from)) * (W - PAD * 2)
  const ticks = to - from <= 20 ? to - from : 10
  let cur = start

  return (
    <svg viewBox={`0 0 ${W} 116`} className="lv-svg">
      <line x1={PAD} y1={78} x2={W - PAD} y2={78} stroke="rgba(255,255,255,.25)" strokeWidth={2} />
      {Array.from({ length: ticks + 1 }).map((_, i) => {
        const v = from + Math.round((i * (to - from)) / ticks)
        return (
          <g key={i}>
            <line x1={x(v)} y1={73} x2={x(v)} y2={83} stroke="rgba(255,255,255,.3)" strokeWidth={1.5} />
            <text x={x(v)} y={98} textAnchor="middle" fontSize={9} fill="var(--dim)">{v}</text>
          </g>
        )
      })}
      <motion.circle cx={x(start)} cy={78} r={6} fill={PALETTE[3]} {...pop(0)} />
      {jumps.map((j, i) => {
        const a = cur, b = cur + j
        cur = b
        const mid = (x(a) + x(b)) / 2
        return (
          <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.3 }}>
            <path d={`M ${x(a)} 74 Q ${mid} ${38 - i * 6} ${x(b)} 74`}
              fill="none" stroke={PALETTE[j > 0 ? 1 : 5]} strokeWidth={2.5} strokeLinecap="round" />
            <text x={mid} y={34 - i * 6} textAnchor="middle" fontSize={11}
              fill={PALETTE[j > 0 ? 1 : 5]} fontWeight="800">{j > 0 ? `+${j}` : j}</text>
            <circle cx={x(b)} cy={78} r={5} fill={PALETTE[j > 0 ? 1 : 5]} />
          </motion.g>
        )
      })}
      <motion.text x={PAD} y={113} fontSize={12} fill="var(--green)" fontWeight="800"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + jumps.length * 0.3 }}>
        {start}{jumps.map((j) => (j > 0 ? ` + ${j}` : ` − ${Math.abs(j)}`)).join('')} = {cur}
      </motion.text>
    </svg>
  )
}

/* ------------------------------- bars ------------------------------------- */
function Bars({ spec }) {
  const bars = (Array.isArray(spec.bars) ? spec.bars : []).slice(0, 5)
    .map((b) => ({ label: String(b?.label ?? '').slice(0, 10), value: clampInt(b?.value, 0, 1000, 0) }))
  if (!bars.length) return null
  const max = Math.max(...bars.map((b) => b.value), 1)
  const BW = 40, GAP = 16
  const W = Math.max(250, bars.length * (BW + GAP) + 20)
  return (
    <svg viewBox={`0 0 ${W} 132`} className="lv-svg">
      {bars.map((b, i) => {
        const h = Math.max(4, (b.value / max) * 78)
        const x = 16 + i * (BW + GAP)
        const c = PALETTE[i % PALETTE.length]
        return (
          <g key={i}>
            <motion.rect x={x} y={96 - h} width={BW} height={h} rx={6} fill={c}
              initial={{ height: 0, y: 96 }} animate={{ height: h, y: 96 - h }}
              transition={{ delay: i * 0.12, type: 'spring', stiffness: 200, damping: 20 }} />
            <motion.text x={x + BW / 2} y={92 - h} textAnchor="middle" fontSize={12} fill={c} fontWeight="800"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 + i * 0.12 }}>
              {b.value}
            </motion.text>
            <text x={x + BW / 2} y={112} textAnchor="middle" fontSize={10} fill="var(--dim)">{b.label}</text>
          </g>
        )
      })}
      <line x1={10} y1={96} x2={W - 10} y2={96} stroke="rgba(255,255,255,.2)" strokeWidth={1.5} />
      {spec.caption && <text x={16} y={128} fontSize={11} fill="var(--gold)" fontWeight="700">{String(spec.caption).slice(0, 48)}</text>}
    </svg>
  )
}

/* ------------------------------- steps ------------------------------------ */
function Steps({ spec }) {
  const boxes = (Array.isArray(spec.boxes) ? spec.boxes : []).slice(0, 3)
  if (!boxes.length) return null
  return (
    <div className="lv-steps">
      {boxes.map((b, i) => (
        <React.Fragment key={i}>
          <motion.div className="lv-step-box"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15, type: 'spring', stiffness: 260, damping: 22 }}>
            <span className="lv-step-title">{String(b?.title || `Langkah ${i + 1}`).slice(0, 24)}</span>
            <b className="lv-step-eq">{String(b?.eq || '').slice(0, 28)}</b>
            {b?.note && <span className="lv-step-note">{String(b.note).slice(0, 40)}</span>}
          </motion.div>
          {i < boxes.length - 1 && (
            <motion.span className="lv-step-arrow"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 + i * 0.15 }}>▸</motion.span>
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

const KINDS = { items: Items, groups: Groups, pie: Pies, grid100: Grid100, numberline: NumberLine, bars: Bars, steps: Steps }

export const VISUAL_KIND_LIST = Object.keys(KINDS)

export default function LessonVisual({ spec }) {
  if (!spec || typeof spec !== 'object') return null
  const C = KINDS[spec.kind]
  if (!C) return null
  return (
    <div className="lv-wrap">
      <C spec={spec} />
    </div>
  )
}
