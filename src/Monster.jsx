// Monster prosedural — satu komponen SVG yang bikin 15+ titan beda dari seed.
// Gaya: gelap & mengancam (kiblat Attack on Titan) — mata cekung menyala, alis
// marah, rahang menganga bertaring, otot & bekas luka. Sengaja TANPA aset eksternal
// & tanpa filter SVG mahal: 15 monster di peta harus jalan offline dan tetap ringan,
// animasinya cuma transform/opacity (compositor) lewat kelas .mon-* di styles.css.
import React, { useMemo } from 'react'

// RNG deterministik — monster ke-N harus selalu sama bentuknya tiap render.
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Titik-titik jadi kurva tertutup halus (catmull-rom → bezier kubik).
function smoothClosed(pts) {
  const n = pts.length
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C${c1x.toFixed(1)} ${c1y.toFixed(1)},${c2x.toFixed(1)} ${c2y.toFixed(1)},${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d + 'Z'
}

// Badan hunched & asimetris: kelonjongan + "lean" diacak per-seed → siluet unik.
function buildBody(rnd) {
  const n = 10 + Math.floor(rnd() * 3)
  const rx = 31 + rnd() * 7
  const ry = 31 + rnd() * 10
  const wob = 0.13 + rnd() * 0.15         // makin besar makin bonggol/grotesk
  const lean = (rnd() * 2 - 1) * 5        // condong kiri/kanan → tak simetris
  const pts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    const k = 1 + (rnd() * 2 - 1) * wob
    pts.push([50 + lean + rx * k * Math.cos(a), 55 + ry * k * Math.sin(a)])
  }
  return smoothClosed(pts)
}

const shade = (hex, amt) => {
  if (!hex || hex[0] !== '#') return hex
  const n = parseInt(hex.slice(1), 16)
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)))
  return `rgb(${c(((n >> 16) & 255) + amt)},${c(((n >> 8) & 255) + amt)},${c((n & 255) + amt)})`
}

/**
 * mood: 'idle' | 'roar' | 'hurt' | 'defeated' | 'sleep'
 * Kelas .mon-body/.mon-arm--l/r/.mon-lid/.mon-mouth/.mon-shadow/.mon-bulb WAJIB
 * dipertahankan — itu yang dianimasikan CSS. Idle/roar diputar lewat compositor,
 * bukan JS, jadi 15 monster sekaligus tetap adem.
 */
export default function Monster({ seed = 0, color = '#8d7bff', size = 64, mood = 'idle', className = '' }) {
  const m = useMemo(() => {
    const rnd = mulberry32(seed * 2654435761 + 12345)
    const body = buildBody(rnd)
    const eyes = [2, 1, 2, 3, 2, 1][seed % 6]
    const horn = seed % 4              // 0 tanduk tulang, 1 tanduk domba, 2 tangkai mata, 3 mahkota duri
    const teeth = 5 + (seed % 3)
    const plates = 4 + (seed % 3)      // lempeng tulang punggung
    const armLift = 0.6 + rnd() * 0.5
    // otot & luka: posisi diacak biar tiap titan punya "cerita" beda
    const scarSide = rnd() > 0.5 ? 1 : -1
    const ribs = rnd() > 0.4          // sebagian titan tulang rusuknya nyembul
    return { body, eyes, horn, teeth, plates, armLift, scarSide, ribs }
  }, [seed])

  const dead = mood === 'defeated'
  const skin = dead ? '#54606e' : color
  const uid = `mn${seed}`
  const dk = (a) => shade(skin, a)          // singkat
  const outline = dk(-78)

  // Mata cekung menyala; jumlah beda-beda per monster.
  const eyeXs = m.eyes === 1 ? [50] : m.eyes === 2 ? [39, 61] : [35, 50, 65]
  const eyeR = m.eyes === 3 ? 6 : m.eyes === 1 ? 11 : 8.5
  const eyeY = 47

  return (
    <svg className={`mon mon--${mood} ${className}`} width={size} height={size}
      viewBox="0 0 100 100" aria-hidden>
      <defs>
        {/* badan: sorot kiri-atas → warna babak → gelap pekat di bawah (volume) */}
        <radialGradient id={`${uid}-b`} cx="40%" cy="26%" r="78%">
          <stop offset="0%" stopColor={dk(48)} />
          <stop offset="45%" stopColor={skin} />
          <stop offset="100%" stopColor={dk(-72)} />
        </radialGradient>
        {/* dada/otot terekspos — lebih gelap & merah-ronce ala titan */}
        <radialGradient id={`${uid}-chest`} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor={dk(-24)} />
          <stop offset="100%" stopColor={dk(-64)} />
        </radialGradient>
        {/* pijar mata: inti panas → warna babak → gelap */}
        <radialGradient id={`${uid}-eye`} cx="50%" cy="42%" r="60%">
          <stop offset="0%" stopColor="#fff7e0" />
          <stop offset="38%" stopColor={dead ? '#7d8996' : dk(120)} />
          <stop offset="100%" stopColor={dead ? '#3c4652' : dk(10)} />
        </radialGradient>
        {/* halo pijar mata (fake glow tanpa filter) */}
        <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={dead ? '#00000000' : dk(130)} stopOpacity={dead ? 0 : 0.55} />
          <stop offset="100%" stopColor={dk(130)} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* bayangan bawah — bikin titan terasa napak, ikut naik-turun pas idle */}
      <ellipse className="mon-shadow" cx="50" cy="91" rx="27" ry="5" fill="#000" opacity=".36" />

      <g className="mon-body">
        {/* ── LEMPENG TULANG PUNGGUNG (asimetris, makin tinggi di tengah) ── */}
        {!dead && Array.from({ length: m.plates }).map((_, i) => {
          const t = (i + 0.5) / m.plates
          const x = 24 + t * 52
          const h = 8 + Math.sin(t * Math.PI) * 12
          const skew = (t - 0.5) * 6            // miring ke luar
          return (
            <path key={i} d={`M${x - 5} 32 L${x + skew} ${32 - h} L${x + 5} 32 Z`}
              fill={dk(-46)} stroke={outline} strokeWidth="0.8" strokeLinejoin="round" />
          )
        })}

        {/* ── TANDUK / TANGKAI (4 varian, semua bertulang & mengancam) ── */}
        {m.horn === 0 && [[31, 27, -1], [69, 27, 1]].map(([x, y, dir], i) => (
          <path key={i} d={`M${x} ${y} L${x + dir * 11} ${y - 21} L${x + dir * 15} ${y - 19} L${x + dir * 2} ${y - 2} Z`}
            fill={dk(-30)} stroke={outline} strokeWidth="1" strokeLinejoin="round" />
        ))}
        {m.horn === 1 && [[28, 30, -1], [72, 30, 1]].map(([x, y, dir], i) => (
          <path key={i} d={`M${x} ${y} Q${x + dir * 17} ${y - 10} ${x + dir * 13} ${y - 22} Q${x + dir * 11} ${y - 15} ${x + dir * 3} ${y - 4} Z`}
            fill={dk(-30)} stroke={outline} strokeWidth="1" strokeLinejoin="round" />
        ))}
        {m.horn === 2 && [[37, 28, -1], [63, 28, 1]].map(([x, y, dir], i) => (
          <g key={i}>
            <path d={`M${x} ${y} Q${x + dir * 3} ${y - 12} ${x + dir * 7} ${y - 18}`}
              fill="none" stroke={dk(-34)} strokeWidth="3.2" strokeLinecap="round" />
            {/* orb terkutuk — pakai .mon-bulb biar denyutnya kepakai */}
            <circle className="mon-bulb" cx={x + dir * 7} cy={y - 19} r="4.6"
              fill={dead ? '#4a5560' : `url(#${uid}-eye)`} stroke={outline} strokeWidth="0.8" />
          </g>
        ))}
        {m.horn === 3 && [[33, 25], [42, 21], [50, 19], [58, 21], [67, 25]].map(([x, y], i) => (
          <path key={i} d={`M${x - 3.5} ${y + 7} L${x} ${y - 9} L${x + 3.5} ${y + 7} Z`}
            fill={dk(-38)} stroke={outline} strokeWidth="0.7" strokeLinejoin="round" />
        ))}

        {/* ── SILUET HALO (badan gelap sedikit lebih besar = kedalaman) ── */}
        <path d={m.body} fill={outline} transform="translate(0,1.5)" opacity=".55" />

        {/* ── BADAN UTAMA ── */}
        <path d={m.body} fill={`url(#${uid}-b)`} stroke={outline} strokeWidth="2.2" />

        {/* ── OTOT/URAT (garis lengkung gelap mengikuti badan) ── */}
        {!dead && (
          <g stroke={dk(-40)} strokeWidth="1.4" fill="none" opacity=".5" strokeLinecap="round">
            <path d="M30 40 Q40 50 34 62" />
            <path d="M70 40 Q60 50 66 62" />
            <path d="M50 36 Q54 52 50 66" opacity=".7" />
          </g>
        )}

        {/* ── DADA/OTOT TEREKSPOS (ala titan) — plat gelap + pita otot ── */}
        <g className={dead ? '' : ''}>
          <ellipse cx="50" cy="66" rx="15" ry="13" fill={`url(#${uid}-chest)`}
            stroke={outline} strokeWidth="1" opacity={dead ? .5 : .9} />
          {!dead && (
            <g stroke={dk(-52)} strokeWidth="1.2" fill="none" opacity=".65">
              <path d="M38 60 Q50 63 62 60" />
              <path d="M37 66 Q50 69 63 66" />
              <path d="M39 72 Q50 75 61 72" />
            </g>
          )}
          {/* tulang rusuk nyembul di satu sisi (sebagian titan) */}
          {!dead && m.ribs && [0, 1, 2].map((k) => (
            <path key={k} d={`M${50 + m.scarSide * 8} ${60 + k * 5} q${m.scarSide * 6} 1 ${m.scarSide * 7} 4`}
              fill="none" stroke={dk(60)} strokeWidth="1.3" opacity=".5" strokeLinecap="round" />
          ))}
        </g>

        {/* ── BEKAS LUKA MENYALA (retak dengan inti panas) ── */}
        {!dead && (
          <g>
            <path d={`M${50 - m.scarSide * 14} 44 l${m.scarSide * 4} 6 l${-m.scarSide * 3} 5 l${m.scarSide * 5} 7`}
              fill="none" stroke={dk(70)} strokeWidth="2.4" strokeLinecap="round" opacity=".9" />
            <path d={`M${50 - m.scarSide * 14} 44 l${m.scarSide * 4} 6 l${-m.scarSide * 3} 5 l${m.scarSide * 5} 7`}
              fill="none" stroke="#ffdca0" strokeWidth="0.9" strokeLinecap="round" opacity=".8" />
          </g>
        )}

        {/* ── LENGAN BERCAKAR (lebih berotot & definisi) ── */}
        {[0, 1].map((i) => {
          const sx = i ? 82 : 18, dir = i ? 1 : -1
          return (
            <g key={i} className={`mon-arm mon-arm--${i ? 'r' : 'l'}`}>
              {/* lengan atas tebal */}
              <path d={`M${sx - dir * 6} 54 Q${sx + dir * 9} ${56 + m.armLift * 6} ${sx + dir * 6} 72`}
                fill="none" stroke={dk(-18)} strokeWidth="9" strokeLinecap="round" />
              <path d={`M${sx - dir * 6} 54 Q${sx + dir * 9} ${56 + m.armLift * 6} ${sx + dir * 6} 72`}
                fill="none" stroke={dk(-46)} strokeWidth="9" strokeLinecap="round" opacity=".28" />
              {/* cakar */}
              {[0, 1, 2].map((k) => (
                <path key={k} d={`M${sx + dir * 6} 72 l${dir * (2.5 + k)} ${6 + k * 1.6}`}
                  stroke={dk(-60)} strokeWidth="2.6" strokeLinecap="round" fill="none" />
              ))}
            </g>
          )
        })}

        {/* ── ALIS MARAH (bayangan menukik ke tengah) ── */}
        {!dead && eyeXs.map((x, i) => {
          const inward = x < 50 ? 1 : x > 50 ? -1 : 0
          return (
            <path key={i}
              d={`M${x - eyeR - 1} ${eyeY - eyeR - 1} L${x + eyeR + 1} ${eyeY - eyeR + 2} L${x + inward * (eyeR + 2)} ${eyeY - 2} Z`}
              fill={dk(-58)} opacity=".9" />
          )
        })}

        {/* ── MATA CEKUNG MENYALA ── */}
        {eyeXs.map((x, i) => (
          <g key={i}>
            {/* rongga gelap */}
            <ellipse cx={x} cy={eyeY} rx={eyeR + 2} ry={eyeR + 2.5} fill={dk(-70)} />
            {dead ? (
              /* K.O. — mata silang */
              <g stroke="#aeb8c4" strokeWidth="2.6" strokeLinecap="round">
                <line x1={x - 4} y1={eyeY - 4} x2={x + 4} y2={eyeY + 4} />
                <line x1={x + 4} y1={eyeY - 4} x2={x - 4} y2={eyeY + 4} />
              </g>
            ) : (
              <>
                {/* halo pijar */}
                <circle cx={x} cy={eyeY} r={eyeR + 4} fill={`url(#${uid}-glow)`} />
                {/* bola mata menyala */}
                <circle cx={x} cy={eyeY} r={eyeR} fill={`url(#${uid}-eye)`} />
                {/* pupil celah reptil */}
                <ellipse className="mon-pupil" cx={x} cy={eyeY} rx={eyeR * 0.24} ry={eyeR * 0.82} fill="#0a0f16" />
                <circle cx={x - eyeR * 0.2} cy={eyeY - eyeR * 0.3} r={eyeR * 0.16} fill="#fff" opacity=".9" />
                {/* kelopak buat kedip — scaleY dari atas via CSS */}
                <rect className="mon-lid" x={x - eyeR - 2} y={eyeY - eyeR - 3}
                  width={eyeR * 2 + 4} height={eyeR * 2 + 6} fill={dk(-30)} />
              </>
            )}
          </g>
        ))}

        {/* ── RAHANG MENGANGA BERTARING ── */}
        <g className="mon-mouth">
          {dead ? (
            /* tumbang — mulut cuma garis meringis lemah */
            <path d="M38 74 Q50 71 62 74" fill="none" stroke={dk(-55)} strokeWidth="2" strokeLinecap="round" />
          ) : (
            <>
              {/* rongga mulut gelap */}
              <path d="M33 65 Q50 70 67 65 Q64 82 50 85 Q36 82 33 65 Z"
                fill="#1c0910" stroke={outline} strokeWidth="1.6" strokeLinejoin="round" />
              {/* lidah/gusi merah di belakang */}
              <path d="M42 78 Q50 84 58 78 Q50 81 42 78 Z" fill="#7a1f2b" opacity=".8" />
              {/* taring atas (menghadap bawah) */}
              {Array.from({ length: m.teeth }).map((_, i) => {
                const x = 36 + (i + 0.5) * (28 / m.teeth)
                const h = 5 + (i % 2) * 2.5
                return <path key={`u${i}`} d={`M${x - 2.4} 66 L${x} ${66 + h} L${x + 2.4} 66 Z`} fill="#efe6cf" />
              })}
              {/* taring bawah (menghadap atas) */}
              {Array.from({ length: m.teeth - 1 }).map((_, i) => {
                const x = 40 + (i + 0.5) * (22 / (m.teeth - 1))
                const h = 4 + ((i + 1) % 2) * 2
                return <path key={`l${i}`} d={`M${x - 2.2} 82 L${x} ${82 - h} L${x + 2.2} 82 Z`} fill="#e6dcc2" />
              })}
            </>
          )}
        </g>
      </g>
    </svg>
  )
}
