import React, { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from './Icon.jsx'
import { AI_PATH, nodeStatus, pathProgress, NODE_PROBLEM_COUNT } from './aiPath.js'
import { skillById, mastery } from './engine.js'
import { GameButton, GameBadge, ProgressTrack } from './GameUI.jsx'
import { t } from './i18n.js'

const TIER_KEY = { locked: 'tier.locked', unlocked: 'tier.unlocked', bronze: 'tier.bronze', silver: 'tier.silver', gold: 'tier.gold' }

// bintang kecil sebagai path — bukan glyph "★" yang bentuknya beda tiap font
const starPath = (cx, cy, r) => {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45
    const a = (Math.PI / 5) * i - Math.PI / 2
    pts.push(`${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`)
  }
  return `M${pts.join('L')}Z`
}

const TIER_COLOR = { locked: 'var(--line)', unlocked: 'var(--dim)', bronze: '#d8a26a', silver: '#cfe0f0', gold: 'var(--gold)' }

// ── Kategori & warna ────────────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'dasar',   labelKey: 'aipath.cat_dasar',    color: '#f4b942', nodes: [0,1,2] },
  { key: 'operasi', labelKey: 'aipath.cat_operasi',  color: '#8d7bff', nodes: [3,4,5] },
  { key: 'lanjutan',labelKey: 'aipath.cat_lanjutan', color: '#ff9f6b', nodes: [6,7,8,9] },
  { key: 'ai',      labelKey: 'aipath.cat_ai',       color: '#3ec98a', nodes: [10,11,12] },
]
const catByIndex = {}
CATEGORIES.forEach(c => c.nodes.forEach(i => catByIndex[i] = c))

// ── Geometri pathway ────────────────────────────────────────────────────────
const NODE_R  = 44       // jari-jari node
const LEFT_X  = 108      // pusat node kiri (lebih ke tengah)
const RIGHT_X = 372      // pusat node kanan (480 - 108)
const ROW_GAP = 148      // jarak vertikal antar baris
const START_Y = 80       // y node pertama
const SVGW    = 480
const CAT_PAD = 54       // ruang ekstra header kategori

// kurva bezier antar dua node: melengkung horizontal lalu vertikal
function curveBetween(a, b) {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const cpx1 = a.x + dx * 0.5
  const cpy1 = a.y + dy * 0.15
  const cpx2 = b.x - dx * 0.5
  const cpy2 = b.y - dy * 0.15
  return `C ${cpx1} ${cpy1}, ${cpx2} ${cpy2}, ${b.x} ${b.y}`
}

// ── Sparkle: partikel kecil di sekitar node aktif ───────────────────────────
const SPARKLE_COLORS = ['#f4b942', '#ffd060', '#fff8e0', '#ffb300']
function Sparkle({ cx, cy, count = 8 }) {
  const particles = useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      angle: (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6,
      dist: 32 + Math.random() * 20,
      size: 2 + Math.random() * 4,
      delay: Math.random() * 1.5,
      color: SPARKLE_COLORS[i % SPARKLE_COLORS.length],
    })), [count])
  return (
    <g>
      {particles.map(p => (
        <motion.circle
          key={p.id}
          r={p.size}
          fill={p.color}
          initial={{ opacity: 0, cx: cx + Math.cos(p.angle) * p.dist * 0.4, cy: cy + Math.sin(p.angle) * p.dist * 0.4 }}
          animate={{
            opacity: [0, 1, 0.6, 0],
            cx: cx + Math.cos(p.angle) * p.dist,
            cy: cy + Math.sin(p.angle) * p.dist,
          }}
          transition={{ duration: 1.8 + p.delay, repeat: Infinity, delay: p.delay, ease: 'easeInOut' }}
        />
      ))}
    </g>
  )
}

// ── Emblem per node ─────────────────────────────────────────────────────────
// Bentuk bingkai: hex (pointy-top), shield, diamond, circle — pakai 92% radius
const R92 = 0.92
const FRAME_PATHS = {
  hex: (cx, cy, r) => {
    const s = r * R92, pts = []
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI/180) * (60 * i)  // pointy-top (no -30 offset)
      pts.push(`${cx + s*Math.cos(a)},${cy + s*Math.sin(a)}`)
    }
    return `M${pts.join('L')}Z`
  },
  shield: (cx, cy, r) =>
    `M${cx} ${cy-r*R92} L${cx+r*R92} ${cy-r*0.3} Q${cx+r*0.35} ${cy+r*0.15} ${cx+r*0.55} ${cy+r*R92} L${cx} ${cy+r*0.6} L${cx-r*0.55} ${cy+r*R92} Q${cx-r*0.35} ${cy+r*0.15} ${cx-r*R92} ${cy-r*0.3} Z`,
  diamond: (cx, cy, r) =>
    `M${cx} ${cy-r*R92} Q${cx+r*0.3} ${cy-r*0.2} ${cx+r*R92} ${cy} Q${cx+r*0.3} ${cy+r*0.2} ${cx} ${cy+r*R92} Q${cx-r*0.3} ${cy+r*0.2} ${cx-r*R92} ${cy} Q${cx-r*0.3} ${cy-r*0.2} ${cx} ${cy-r*R92} Z`,
  circle: (cx, cy, r) =>
    `M${cx} ${cy-r*R92} A${r*R92} ${r*R92} 0 1 1 ${cx-0.01} ${cy-r*R92} Z`,
}
const FRAME_NAMES = ['hex', 'shield', 'diamond', 'circle']

function NodeEmblem({ node, index, status, stars }) {
  const cat = catByIndex[index] || { color: '#f4b942' }
  const R = NODE_R
  const cx = R, cy = R
  const size = R * 2
  const shape = FRAME_NAMES[index % 4]
  const locked = status === 'locked'
  const avail  = status === 'available'
  const done   = status === 'cleared'
  const primary = locked ? '#3a5068' : done ? 'var(--green)' : cat.color
  const bg1 = locked ? '#1a2838' : done ? '#0f3020' : `${cat.color}18`
  const bg2 = locked ? '#0f1c28' : done ? '#071a10' : `${cat.color}06`

  return (
    <div className="duo-emblem" style={{ width: size, height: size }}>
      {/* glow luar */}
      {avail && (
        <motion.div className="duo-emblem-glow"
          style={{ width: size+20, height: size+20, background: `radial-gradient(circle, ${cat.color}55 0%, transparent 70%)` }}
          animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.06, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <radialGradient id={`dubg-${index}`} cx="40%" cy="30%">
            <stop offset="0%" stopColor={bg1} stopOpacity={0.95} />
            <stop offset="100%" stopColor={bg2} stopOpacity={0.9} />
          </radialGradient>
          <linearGradient id={`dubr-${index}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={primary} stopOpacity={1} />
            <stop offset="100%" stopColor={primary} stopOpacity={0.5} />
          </linearGradient>
          <filter id={`duglow-${index}`}>
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* ornamen latar — cincin dalam */}
        <circle cx={cx} cy={cy} r={R*0.72} fill="none" stroke={primary} strokeOpacity={0.08} strokeWidth={1} strokeDasharray="3 5" />
        <circle cx={cx} cy={cy} r={R*0.42} fill={primary} fillOpacity={0.04} />
        {/* bingkai utama */}
        <path d={FRAME_PATHS[shape](cx, cy, R)} fill={`url(#dubg-${index})`}
          stroke={`url(#dubr-${index})`} strokeWidth={avail ? 2.8 : 2}
          filter={avail ? `url(#duglow-${index})` : undefined}
          strokeLinejoin="round" />
        {/* titik sudut — di 4 penjuru */}
        {!locked && [[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx,sy]) => (
          <circle key={`${sx}${sy}`} cx={cx + sx*R*0.45} cy={cy + sy*R*0.45} r={2.5} fill={primary} opacity={0.45} />
        ))}
        {/* bintang — posisi di dalam emblem */}
        {done && [-1,0,1].map((s,idx) => (
          <path key={idx} d={starPath(cx + s*12, cy + 4, 6)}
            fill="#f4b942" opacity={idx < stars ? 1 : 0.15} />
        ))}
        {/* ikon tengah — naik kalau ada bintang */}
        <foreignObject x={cx-14} y={done ? cy-24 : cy-14} width={28} height={28}>
          <div style={{ width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center',
            color: locked ? 'var(--dim)' : primary, opacity: locked ? 0.4 : 1 }}>
            <Icon name={locked ? 'ph:lock-fill' : node.icon} size={22} />
          </div>
        </foreignObject>
      </svg>
    </div>
  )
}

// ── Header kategori ─────────────────────────────────────────────────────────
function CatBanner({ cat, top, lang }) {
  return (
    <motion.div className="duo-cat-banner" style={{ top }}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}>
      <div className="duo-cat-bg" style={{
        background: `linear-gradient(135deg, ${cat.color}18, ${cat.color}06)`,
        borderColor: `${cat.color}33`,
      }}>
        <span className="duo-cat-dot" style={{ background: cat.color, boxShadow: `0 0 10px ${cat.color}66` }} />
        <span className="duo-cat-label" style={{ color: cat.color }}>{t(cat.labelKey, lang)}</span>
        <span className="duo-cat-dot" style={{ background: cat.color, boxShadow: `0 0 10px ${cat.color}66` }} />
      </div>
    </motion.div>
  )
}

// ── Halaman utama ───────────────────────────────────────────────────────────
export default function AIPath({ g, onStart, onClose }) {
  const [sel, setSel] = useState(null)
  const prog = pathProgress(g)

  // hitung posisi semua node + tinggi SVG
  const { positions, totalH } = useMemo(() => {
    let catOff = 0
    const poss = AI_PATH.map((_, i) => {
      const cat = catByIndex[i]
      if (i > 0 && cat && cat.nodes[0] === i) catOff += CAT_PAD
      const pair = Math.floor(i / 2)
      const x = i % 2 === 0 ? LEFT_X : RIGHT_X
      const y = START_Y + pair * ROW_GAP + (i % 2) * (ROW_GAP * 0.45) + catOff
      return { x, y }
    })
    const last = poss[poss.length - 1]
    return { positions: poss, totalH: last.y + NODE_R + 70 }
  }, [])

  // path string untuk konektor
  const pathSegments = useMemo(() => {
    const segs = []
    for (let i = 0; i < positions.length - 1; i++) {
      const a = positions[i], b = positions[i+1]
      const cat = catByIndex[i]
      segs.push({ d: `M ${a.x} ${a.y} ${curveBetween(a, b)}`, color: cat?.color || '#f4b942' })
    }
    return segs
  }, [positions])

  // node pertama yang available (buat sparkle)
  const activeIdx = AI_PATH.findIndex((_, i) => nodeStatus(g, i) === 'available')
  const activePos = activeIdx >= 0 ? positions[activeIdx] : null
  const allDone = prog.done >= prog.total

  // Bawa layar langsung ke node yang lagi kebuka — jalur ini panjang, dan yang
  // dicari user pas buka halaman selalu "gue lanjut dari mana".
  const activeRef = useRef(null)
  useEffect(() => {
    if (!activeRef.current) return
    const t = setTimeout(() => activeRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 620)
    return () => clearTimeout(t)
  }, [activeIdx])

  // ringkasan per kategori buat header
  const catStats = CATEGORIES.map((c) => {
    const done = c.nodes.filter((i) => AI_PATH[i] && nodeStatus(g, i) === 'cleared').length
    return { ...c, done, total: c.nodes.filter((i) => AI_PATH[i]).length }
  })

  return (
    <div className="screen" style={{ padding: '16px 0 110px', gap: 0 }}>
      {/* header */}
      <div className="duo-header">
        <div>
          <h1 style={{ fontSize: 28, letterSpacing: '-.03em' }}>{t('aipath.page_title', g.lang)}</h1>
          <p style={{ fontSize: 13 }}>{t('aipath.page_sub', g.lang)}</p>
        </div>
        <button className="pill icon-btn" onClick={onClose} aria-label="Tutup">
          <Icon name="x" size={18} />
        </button>
      </div>

      {/* progress bar compact */}
      <div className="duo-progress">
        <div className="row" style={{ gap: 8 }}>
          <Icon name="ph:robot-fill" size={18} color="var(--violet)" />
          <ProgressTrack value={prog.total ? prog.done / prog.total : 0} color="var(--violet)" height={7} />
        </div>
        <GameBadge label={`${prog.done}/${prog.total}`} color="var(--violet)" bg="rgba(141,123,255,.15)" />
      </div>

      {/* ringkasan per babak — sekilas tahu udah sampai mana */}
      <div className="duo-cats">
        {catStats.map((c) => (
          <div key={c.key} className={'duo-cat-chip' + (c.done === c.total ? ' done' : '')}
            style={{ '--cc': c.color }}>
            <span className="duo-cat-chip-label">{t(c.labelKey, g.lang)}</span>
            <span className="duo-cat-chip-n">{c.done}/{c.total}</span>
            <span className="duo-cat-chip-bar"><i style={{ width: `${(c.done / c.total) * 100}%` }} /></span>
          </div>
        ))}
      </div>

      {/* pathway map */}
      <div className="duo-map" style={{ height: totalH + 20 }}>
        {/* SVG konektor */}
        <svg className="duo-svg" width={SVGW} height={totalH} viewBox={`0 0 ${SVGW} ${totalH}`}
          preserveAspectRatio="xMidYMid meet">
          <defs>
            {pathSegments.map((seg, i) => (
              <linearGradient key={i} id={`pg-${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={seg.color} stopOpacity={0.7} />
                <stop offset="100%" stopColor={seg.color} stopOpacity={0.35} />
              </linearGradient>
            ))}
          </defs>

          {/* garis konektor — animasi menggambar */}
          {pathSegments.map((seg, i) => (
            <motion.path key={i} d={seg.d}
              fill="none" stroke={`url(#pg-${i})`}
              strokeWidth={5} strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 0.7, delay: i * 0.08, ease: 'easeInOut' }}
            />
          ))}

          {/* titik-titik dekoratif di sepanjang path */}
          {pathSegments.map((seg, i) => (
            <motion.circle key={`dot-${i}`}
              cx={positions[i].x + (positions[i+1].x - positions[i].x) * 0.5}
              cy={positions[i].y + (positions[i+1].y - positions[i].y) * 0.5}
              r={4} fill={seg.color} opacity={0.6}
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: 0.5 + i * 0.08, type: 'spring' }}
            />
          ))}

          {/* sparkle di node aktif */}
          {activePos && <Sparkle cx={activePos.x} cy={activePos.y} count={10} />}

          {/* garis akhir — piala penamat jalur */}
          <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }}>
            <line x1={LEFT_X-30} y1={totalH-30} x2={RIGHT_X+30} y2={totalH-30}
              stroke="var(--gold)" strokeWidth={2} strokeDasharray="6 4" opacity={0.5} />
            <circle cx={LEFT_X} cy={totalH-30} r={17}
              fill={allDone ? 'rgba(244,185,66,.22)' : 'rgba(244,185,66,.1)'}
              stroke="var(--gold)" strokeWidth={1.5} strokeOpacity={allDone ? 1 : 0.5} />
            <foreignObject x={LEFT_X-11} y={totalH-41} width={22} height={22}>
              <div style={{ display: 'grid', placeItems: 'center', width: 22, height: 22,
                color: 'var(--gold)', opacity: allDone ? 1 : 0.45 }}>
                <Icon name="ph:trophy-fill" size={17} />
              </div>
            </foreignObject>
          </motion.g>
        </svg>

        {/* node cards + category banners */}
        {AI_PATH.map((node, i) => {
          const status = nodeStatus(g, i)
          const stars = g.aiPath?.cleared?.[node.id] || 0
          const pos = positions[i]
          const cat = catByIndex[i]
          const showCat = cat && i > 0 && cat.nodes[0] === i

          return (
            <React.Fragment key={node.id}>
              {showCat && <CatBanner cat={cat} top={`${pos.y - NODE_R - 16}px`} lang={g.lang} />}

              <motion.div
                ref={i === activeIdx ? activeRef : undefined}
                className={`duo-node ${status}`}
                style={{ left: pos.x - NODE_R, top: pos.y - NODE_R }}
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  type: 'spring', stiffness: 300, damping: 22,
                  delay: i * 0.07,
                }}
                whileHover={status !== 'locked' ? { scale: 1.08 } : undefined}
                whileTap={status !== 'locked' ? { scale: 0.94 } : undefined}
                onClick={() => status !== 'locked' && setSel({ node, index: i, status })}
              >
                <NodeEmblem node={node} index={i} status={status} stars={stars} />

                {/* label di bawah */}
                <div className="duo-node-label">
                  <span className="duo-node-title">{node.title}</span>
                  {status === 'cleared' && (
                    <span className="duo-node-badge" style={{ background: 'rgba(62,201,138,.18)', color: 'var(--green)' }}>
                      ★{stars}
                    </span>
                  )}
                  {status === 'available' && (
                    <motion.span className="duo-node-badge"
                      style={{ background: `${cat?.color || 'var(--gold)'}22`, color: cat?.color || 'var(--gold)' }}
                      animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.8, repeat: Infinity }}>
                      {t('aipath.ready', g.lang)}
                    </motion.span>
                  )}
                  {status === 'locked' && (
                    <span className="duo-node-badge" style={{ background: 'rgba(255,255,255,.04)', color: 'var(--dim)' }}>
                      <Icon name="ph:lock-fill" size={10} />
                    </span>
                  )}
                </div>
              </motion.div>
            </React.Fragment>
          )
        })}
      </div>

      {/* modal detail */}
      <AnimatePresence>
        {sel && (
          <motion.div className="modal-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setSel(null)}>
            <motion.div className="modal-panel" onClick={e => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}>
              <div className="duo-modal-inner">
                <NodeEmblem node={sel.node} index={sel.index} status={sel.status}
                  stars={g.aiPath?.cleared?.[sel.node.id] || 0} />
                <h2>{sel.node.title}</h2>
                <p className="center">{sel.node.why}</p>
                <div className="row center-x" style={{ gap: 6, flexWrap: 'wrap' }}>
                  <GameBadge label={`${NODE_PROBLEM_COUNT} soal`} color="var(--dim)" bg="rgba(255,255,255,.06)" />
                  {sel.status === 'cleared' && <GameBadge label={t('aipath.done', g.lang)} color="var(--green)" bg="rgba(62,201,138,.15)" />}
                  {sel.status === 'available' && (
                    <GameBadge label={t('aipath.ready_start', g.lang)} color={catByIndex[sel.index]?.color || 'var(--gold)'}
                      bg={`${catByIndex[sel.index]?.color || 'var(--gold)'}22`} />
                  )}
                </div>

                {/* Rincian materi — user tahu persis apa yang bakal dilatih */}
                <div className="duo-skills">
                  <span className="duo-skills-head">{t('aipath.skills_head', g.lang)}</span>
                  {sel.node.skillIds.map((id) => {
                    const sk = skillById[id]
                    if (!sk) return null
                    const m = mastery(g.skills?.[id])
                    return (
                      <div key={id} className="duo-skill">
                        <span className="duo-skill-dot" style={{ background: TIER_COLOR[m.tier] }} />
                        <span className="duo-skill-name">{sk.name}</span>
                        <span className="duo-skill-tier" style={{ color: TIER_COLOR[m.tier] }}>
                          {m.n ? `${Math.round(m.acc * 100)}%` : t(TIER_KEY[m.tier], g.lang)}
                        </span>
                      </div>
                    )
                  })}
                </div>
                <GameButton onClick={() => onStart(sel.node)}>
                  <Icon name="ph:play-fill" size={18} /> {sel.status === 'cleared' ? t('aipath.repeat', g.lang) : t('aipath.start', g.lang)}
                </GameButton>
                <button className="btn ghost" onClick={() => setSel(null)}>{t('pomo.later', g.lang)}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
