import React, { useState, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from './Icon.jsx'
import Monster from './Monster.jsx'
import { AI_PATH, nodeStatus, pathProgress, NODE_PROBLEM_COUNT, CATEGORIES, catByIndex } from './aiPath.js'
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

// Kategori & warna sekarang tinggal di aiPath.js — dipakai bareng arena tempur.

// ── Geometri pathway ────────────────────────────────────────────────────────
const NODE_R  = 44       // jari-jari node
const LEFT_X  = 112      // pusat node kiri (lebih ke tengah)
const RIGHT_X = 368      // pusat node kanan (480 - 112)
const ROW_GAP = 152      // jarak vertikal antar baris
const START_Y = 80       // y node pertama
const SVGW    = 480
const CAT_PAD = 104      // ruang ekstra header kategori (cukup buat papan babak)
const LABEL_H = 62       // perkiraan tinggi label di bawah emblem (judul 2 baris + badge)
const NODE_W  = 150      // lebar kotak node (emblem + label) — dipakai buat centering

// SVG di-stretch mengikuti lebar layar (preserveAspectRatio="none"), jadi node
// HTML harus dipasang pakai persen di sumbu X biar nempel persis di atas jalur.
// Sumbu Y tetap 1:1 karena tinggi SVG = tinggi viewBox.
const pctX = (x) => `${(x / SVGW) * 100}%`

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

// ── Emblem per node — medali game yang lembut & mengkilap (bukan poligon kaku) ─
// 4 bentuk organik: perisai, permata, medali bergerigi, squircle. Semua pakai
// kurva halus + bingkai metalik + kilau, biar terasa aset game, bukan ikon datar.
const SOFT_FRAMES = {
  shield: (cx, cy, r) => {
    const w = r * 0.9, t = cy - r * 0.9
    return `M${cx - w * 0.78} ${t + r * 0.2}
      Q${cx - w * 0.78} ${t} ${cx - w * 0.5} ${t}
      L${cx + w * 0.5} ${t} Q${cx + w * 0.78} ${t} ${cx + w * 0.78} ${t + r * 0.2}
      L${cx + w * 0.78} ${cy + r * 0.06}
      Q${cx + w * 0.78} ${cy + r * 0.68} ${cx} ${cy + r * 0.92}
      Q${cx - w * 0.78} ${cy + r * 0.68} ${cx - w * 0.78} ${cy + r * 0.06} Z`
  },
  gem: (cx, cy, r) => {
    const R = r * 0.9
    return `M${cx} ${cy - R}
      Q${cx + R * 0.64} ${cy - R * 0.64} ${cx + R} ${cy}
      Q${cx + R * 0.64} ${cy + R * 0.64} ${cx} ${cy + R}
      Q${cx - R * 0.64} ${cy + R * 0.64} ${cx - R} ${cy}
      Q${cx - R * 0.64} ${cy - R * 0.64} ${cx} ${cy - R} Z`
  },
  scallop: (cx, cy, r) => {
    const n = 8, R1 = r * 0.92, R2 = r * 0.74
    let d = ''
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * 2 * Math.PI - Math.PI / 2
      const a1 = ((i + 0.5) / n) * 2 * Math.PI - Math.PI / 2
      const a2 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2
      d += (i === 0 ? `M${cx + R2 * Math.cos(a0)} ${cy + R2 * Math.sin(a0)}` : '')
        + ` Q${cx + R1 * Math.cos(a1)} ${cy + R1 * Math.sin(a1)} ${cx + R2 * Math.cos(a2)} ${cy + R2 * Math.sin(a2)}`
    }
    return d + 'Z'
  },
  squircle: (cx, cy, r) => {
    const s = r * 0.86, k = s * 0.55
    return `M${cx} ${cy - s}
      C${cx + k} ${cy - s} ${cx + s} ${cy - k} ${cx + s} ${cy}
      C${cx + s} ${cy + k} ${cx + k} ${cy + s} ${cx} ${cy + s}
      C${cx - k} ${cy + s} ${cx - s} ${cy + k} ${cx - s} ${cy}
      C${cx - s} ${cy - k} ${cx - k} ${cy - s} ${cx} ${cy - s} Z`
  },
}
const FRAME_NAMES = ['shield', 'gem', 'scallop', 'squircle']

// geser hex warna terang/gelap buat efek bevel metalik
const shade = (hex, amt) => {
  if (!hex || hex[0] !== '#') return hex
  const n = parseInt(hex.slice(1), 16)
  const cl = (v) => Math.max(0, Math.min(255, v))
  return `rgb(${cl(((n >> 16) & 255) + amt)},${cl(((n >> 8) & 255) + amt)},${cl((n & 255) + amt)})`
}

function NodeEmblem({ node, index, status, stars }) {
  const cat = catByIndex[index] || { color: '#f4b942' }
  const R = NODE_R, cx = R, cy = R, size = R * 2
  const frame = SOFT_FRAMES[FRAME_NAMES[index % 4]]
  const locked = status === 'locked'
  const avail = status === 'available'
  const done = status === 'cleared'
  const accent = locked ? '#3a5068' : done ? '#3ec98a' : cat.color
  const uid = `em${index}`
  const outer = frame(cx, cy, R)
  const inner = frame(cx, cy, R * 0.72)

  return (
    <div className="duo-emblem" style={{ width: size, height: size }}>
      {avail && (
        <motion.div className="duo-emblem-glow"
          style={{ width: size + 24, height: size + 24, background: `radial-gradient(circle, ${accent}55 0%, transparent 66%)` }}
          animate={{ opacity: [0.45, 0.9, 0.45], scale: [1, 1.09, 1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }} />
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id={`${uid}-fr`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={shade(accent, 60)} />
            <stop offset="50%" stopColor={accent} />
            <stop offset="100%" stopColor={shade(accent, -65)} />
          </linearGradient>
          <radialGradient id={`${uid}-in`} cx="50%" cy="34%">
            <stop offset="0%" stopColor={locked ? '#18293d' : shade(accent, -42)} />
            <stop offset="100%" stopColor={locked ? '#0b1624' : '#091420'} />
          </radialGradient>
          <linearGradient id={`${uid}-gl`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${uid}-clip`}><path d={inner} /></clipPath>
          <filter id={`${uid}-glow`}>
            <feGaussianBlur stdDeviation="2.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* bingkai metalik dengan bevel */}
        <path d={outer} fill={`url(#${uid}-fr)`} stroke={shade(accent, -75)} strokeWidth="1"
          filter={avail ? `url(#${uid}-glow)` : undefined} opacity={locked ? 0.85 : 1} strokeLinejoin="round" />
        {/* rongga dalam */}
        <path d={inner} fill={`url(#${uid}-in)`} stroke={accent} strokeOpacity="0.35" strokeWidth="1" strokeLinejoin="round" />
        {/* kilau atas — di-clip ke rongga */}
        <ellipse cx={cx} cy={cy - R * 0.34} rx={R * 0.5} ry={R * 0.3}
          fill={`url(#${uid}-gl)`} clipPath={`url(#${uid}-clip)`} opacity={locked ? 0.12 : 0.5} />
        {/* paku hias di 4 penjuru diagonal */}
        {!locked && [0, 1, 2, 3].map((i) => {
          const a = (i / 4) * 2 * Math.PI + Math.PI / 4
          return <circle key={i} cx={cx + R * 0.78 * Math.cos(a)} cy={cy + R * 0.78 * Math.sin(a)} r="2.2"
            fill={shade(accent, 45)} opacity="0.75" />
        })}
        {/* penghuni node: monster. Statusnya jadi cerita — yang belum kebuka
            masih tidur di balik gembok, yang kebuka ngamuk, yang kelar udah K.O. */}
        <foreignObject x={cx - R * 0.76} y={cy - R * 0.86} width={R * 1.52} height={R * 1.52}>
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center' }}>
            <Monster seed={index} size={R * 1.5} mood={locked ? 'sleep' : done ? 'defeated' : 'roar'}
              color={locked ? '#3d5268' : accent} />
          </div>
        </foreignObject>
        {/* gembok ditaruh di pojok, bukan nutupin muka monsternya */}
        {locked && (
          <g>
            <circle cx={cx + R * 0.6} cy={cy + R * 0.6} r="11" fill="#0b1624"
              stroke="#3a5068" strokeWidth="1.5" />
            <foreignObject x={cx + R * 0.6 - 7} y={cy + R * 0.6 - 7} width="14" height="14">
              <div style={{ display: 'grid', placeItems: 'center', color: '#7e94ab' }}>
                <Icon name="ph:lock-fill" size={13} />
              </div>
            </foreignObject>
          </g>
        )}
        {/* bintang di lengkung bawah utk node tuntas */}
        {done && [-1, 0, 1].map((s, idx) => (
          <path key={idx} d={starPath(cx + s * 11, cy + R * 0.54, 5.4)}
            fill="#ffd060" stroke="#c9962e" strokeWidth="0.5" opacity={idx < stars ? 1 : 0.22} />
        ))}
      </svg>
    </div>
  )
}

// ── Header kategori ─────────────────────────────────────────────────────────
function CatBanner({ cat, top, lang }) {
  return (
    /* cuma opacity yang dianimasi — begitu framer nulis transform, translateX(-50%)
       dari CSS ketimpa dan bannernya lari dari tengah */
    <motion.div className="duo-cat-banner" style={{ top }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}>
      <div className="duo-cat-bg" style={{
        background: `linear-gradient(135deg, ${cat.color}2e, ${cat.color}12), #0a1523`,
        borderColor: `${cat.color}55`,
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

  // hitung posisi semua node + tinggi SVG. Papan babak dapat jalur y sendiri —
  // ditaruh di bawah label node sebelumnya, bukan digantung ke node berikutnya,
  // biar nggak pernah nabrak tulisan.
  const { positions, totalH, bannerY } = useMemo(() => {
    let catOff = 0
    const banners = {}
    const poss = AI_PATH.map((_, i) => {
      const cat = catByIndex[i]
      if (i > 0 && cat && cat.nodes[0] === i) catOff += CAT_PAD
      const pair = Math.floor(i / 2)
      const x = i % 2 === 0 ? LEFT_X : RIGHT_X
      const y = START_Y + pair * ROW_GAP + (i % 2) * (ROW_GAP * 0.45) + catOff
      return { x, y }
    })
    AI_PATH.forEach((_, i) => {
      const cat = catByIndex[i]
      if (i > 0 && cat && cat.nodes[0] === i) banners[i] = poss[i - 1].y + NODE_R + LABEL_H
    })
    const last = poss[poss.length - 1]
    return { positions: poss, totalH: last.y + NODE_R + LABEL_H + 76, bannerY: banners }
  }, [])

  // path string untuk konektor. Ruas dianggap "sudah dilewati" kalau node
  // pangkalnya tuntas — itu yang bikin aspal nyala & garis putusnya jalan.
  const pathSegments = useMemo(() => {
    const segs = []
    for (let i = 0; i < positions.length - 1; i++) {
      const a = positions[i], b = positions[i+1]
      const cat = catByIndex[i]
      segs.push({
        d: `M ${a.x} ${a.y} ${curveBetween(a, b)}`,
        color: cat?.color || '#f4b942',
        lit: nodeStatus(g, i) === 'cleared',
      })
    }
    // ruas penutup ke garis finis — biar aspalnya nggak putus menggantung
    const last = positions[positions.length - 1]
    const end = { x: SVGW / 2, y: totalH - 62 }
    segs.push({
      d: `M ${last.x} ${last.y} ${curveBetween(last, end)}`,
      color: '#f4b942',
      lit: nodeStatus(g, AI_PATH.length - 1) === 'cleared',
    })
    return segs
  }, [positions, totalH, g])

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
        {/* SVG jalur — di-stretch horizontal; stroke dikunci pakai
            non-scaling-stroke biar tebal aspal tetap sama di layar sempit */}
        <svg className="duo-svg" height={totalH} viewBox={`0 0 ${SVGW} ${totalH}`}
          preserveAspectRatio="none">
          {/* aspal: bahu gelap → badan jalan → marka putus-putus yang jalan */}
          {pathSegments.map((seg, i) => (
            <motion.g key={i} className="duo-road" style={{ '--rc': seg.color }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: i * 0.05 }}>
              <path d={seg.d} className="duo-road-case" vectorEffect="non-scaling-stroke" />
              <path d={seg.d} className={'duo-road-body' + (seg.lit ? ' lit' : '')}
                vectorEffect="non-scaling-stroke" />
              <path d={seg.d} className={'duo-road-mark' + (seg.lit ? ' lit' : '')}
                vectorEffect="non-scaling-stroke" />
            </motion.g>
          ))}

          {/* sparkle di node aktif */}
          {activePos && <Sparkle cx={activePos.x} cy={activePos.y} count={10} />}
        </svg>

        {/* garis finis — HTML biar tulisannya tajam & nggak ikut ke-stretch */}
        <motion.div className={'duo-finish' + (allDone ? ' won' : '')}
          style={{ top: totalH - 52 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          <span className="duo-finish-flag" />
          <span className="duo-finish-badge">
            <Icon name="ph:trophy-fill" size={16} color={allDone ? '#1b1204' : 'var(--gold)'} />
            {t('aipath.finish', g.lang)}
          </span>
          <span className="duo-finish-flag" />
        </motion.div>

        {/* node cards + category banners */}
        {AI_PATH.map((node, i) => {
          const status = nodeStatus(g, i)
          const stars = g.aiPath?.cleared?.[node.id] || 0
          const pos = positions[i]
          const cat = catByIndex[i]
          const showCat = cat && i > 0 && cat.nodes[0] === i

          return (
            <React.Fragment key={node.id}>
              {showCat && <CatBanner cat={cat} top={`${bannerY[i]}px`} lang={g.lang} />}

              <motion.div
                ref={i === activeIdx ? activeRef : undefined}
                className={`duo-node ${status}`}
                style={{ left: `calc(${pctX(pos.x)} - ${NODE_W / 2}px)`, top: pos.y - NODE_R,
                  '--nc': cat?.color || 'var(--gold)' }}
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
