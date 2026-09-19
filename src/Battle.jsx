// Arena pertempuran Jalur AI — kerajaan kiri, monster kanan.
// Aturannya: waktu habis / salah = monster mukul tembok, benar = pasukan nyerang
// balik dan jumlahnya nambah. Semua cuma SVG + transform, nggak ada aset eksternal.
import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Monster from './Monster.jsx'
import Icon from './Icon.jsx'

const GROUND = 120

// Tembok makin remuk seiring HP turun: 0 utuh → 3 tinggal puing.
const wallStage = (hp) => (hp > 75 ? 0 : hp > 50 ? 1 : hp > 25 ? 2 : 3)

function Castle({ hp }) {
  const s = wallStage(hp)
  // tiap menara punya tinggi sendiri; makin parah makin pendek & miring
  const towers = [
    { x: 14, w: 22, h: 54 },
    { x: 40, w: 26, h: 70 },
    { x: 70, w: 22, h: 58 },
  ]
  return (
    <g>
      {towers.map((t, i) => {
        const loss = Math.min(t.h - 12, s * (10 + i * 4))
        const h = t.h - loss
        const tilt = s >= 2 ? (i - 1) * 2.5 * (s - 1) : 0
        return (
          <g key={i} style={{ transform: `rotate(${tilt}deg)`, transformOrigin: `${t.x + t.w / 2}px ${GROUND}px` }}>
            <rect x={t.x} y={GROUND - h} width={t.w} height={h} rx="2"
              fill="#33506e" stroke="#1b2f45" strokeWidth="1.5" />
            {/* jendela nyala selama benteng masih hidup */}
            {s < 3 && <rect x={t.x + t.w / 2 - 3} y={GROUND - h * 0.55} width="6" height="8" rx="1"
              fill={s >= 2 ? '#6b4a2a' : '#f4b942'} opacity={s >= 2 ? .7 : .95} />}
            {/* gerigi atas — rontok satu per satu */}
            {s < 3 && Array.from({ length: 3 }).map((_, k) => (
              (k + s) % 4 === 3 ? null : (
                <rect key={k} x={t.x + 1 + k * ((t.w - 2) / 3)} y={GROUND - h - 5}
                  width={(t.w - 2) / 3 - 2} height="5" fill="#3d5c7d" />
              )
            ))}
            {/* retakan muncul mulai stage 1 */}
            {s >= 1 && <path d={`M${t.x + t.w * 0.5} ${GROUND - h + 6} l-4 12 l5 8 l-3 10`}
              stroke="#16273a" strokeWidth="1.6" fill="none" />}
          </g>
        )
      })}
      {/* bendera nempel di puncak menara tengah — puncaknya naik-turun ikut
          kerusakan, jadi tingginya harus +loss (bukan -loss, itu bikin melayang) */}
      {s < 3 && (() => {
        const topY = GROUND - 70 + loss0(s)
        return (
          <g>
            <line x1="53" y1={topY} x2="53" y2={topY - 14} stroke="#8fa6bd" strokeWidth="1.6" />
            <path d={`M53 ${topY - 14} l12 4 l-12 4 Z`} fill="var(--gold)" />
          </g>
        )
      })()}
      {/* puing di tanah */}
      {s >= 1 && Array.from({ length: s * 3 }).map((_, i) => (
        <rect key={i} x={8 + ((i * 13) % 92)} y={GROUND - 4 - (i % 2) * 3} width="7" height="4"
          rx="1" fill="#2a4059" opacity=".85" />
      ))}
    </g>
  )
}
const loss0 = (s) => Math.min(58, s * 14)

// Pasukan: jumlah prajurit ikut naik tiap beberapa jawaban benar.
function Army({ count, attacking }) {
  return (
    <g>
      <AnimatePresence>
        {Array.from({ length: count }).map((_, i) => (
          <motion.g key={i}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            <motion.g
              animate={attacking ? { x: [0, 9, 0], y: [0, -4, 0] } : { x: 0, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}>
              {/* badan + kepala + tombak + perisai */}
              <rect x={106 + i * 14} y={GROUND - 22} width="10" height="18" rx="4" fill="#5b8fd0" />
              <circle cx={111 + i * 14} cy={GROUND - 26} r="5.5" fill="#cfe2f7" />
              <path d={`M${104 + i * 14} ${GROUND - 18} l0 10 l4 3 l4 -3 l0 -10 Z`}
                fill="#8fb6e0" opacity=".9" />
              <line x1={118 + i * 14} y1={GROUND - 34} x2={118 + i * 14} y2={GROUND - 4}
                stroke="#b9cde3" strokeWidth="2" />
              <path d={`M${118 + i * 14} ${GROUND - 34} l-3 4 l6 0 Z`} fill="#e8f2ff" />
            </motion.g>
          </motion.g>
        ))}
      </AnimatePresence>
    </g>
  )
}

export default function Battle({ seed = 0, color = '#8d7bff', wallHp, monHp, army, fx, lang }) {
  const [shake, setShake] = useState(false)
  const [volley, setVolley] = useState(false)
  const [mood, setMood] = useState('idle')
  const moodTimer = useRef(null)

  // fx = {type, n} — n naik tiap kejadian, jadi efek yang sama bisa dipicu ulang.
  useEffect(() => {
    if (!fx) return
    clearTimeout(moodTimer.current)
    if (fx.type === 'hit') {          // kita yang mukul
      setVolley(true); setMood('hurt')
      moodTimer.current = setTimeout(() => { setVolley(false); setMood('idle') }, 620)
    } else if (fx.type === 'smash') { // monster yang mukul
      setShake(true); setMood('roar')
      moodTimer.current = setTimeout(() => { setShake(false); setMood('idle') }, 700)
    }
    return () => clearTimeout(moodTimer.current)
  }, [fx?.n]) // eslint-disable-line

  const stage = wallStage(wallHp)
  const dead = monHp <= 0

  return (
    <div className={'bt' + (shake ? ' bt--shake' : '')}>
      {/* bar HP dua sisi */}
      <div className="bt-bars">
        <div className="bt-bar bt-bar--wall">
          <Icon name="ph:castle-turret-fill" size={14} color="#7fb0e8" />
          <span className="bt-track"><i style={{ width: `${Math.max(0, wallHp)}%` }} /></span>
        </div>
        <div className="bt-bar bt-bar--mon">
          <span className="bt-track bt-track--mon"><i style={{ width: `${Math.max(0, monHp)}%`, background: color }} /></span>
          <Icon name="ph:skull-fill" size={14} color={color} />
        </div>
      </div>

      <svg className="bt-stage" viewBox="0 0 300 140" preserveAspectRatio="xMidYMax meet">
        {/* langit + tanah */}
        <defs>
          <linearGradient id="bt-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0d1a2b" />
            <stop offset="100%" stopColor="#132538" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="300" height="140" fill="url(#bt-sky)" />
        {/* bulan ditaruh di kiri — kalau di kanan ketutupan badan monster */}
        <circle cx="128" cy="24" r="12" fill="#e8f0ff" opacity=".14" />
        {[[40, 18], [72, 30], [176, 20]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.3" fill="#dbe8ff" opacity=".5" />
        ))}
        <path d="M0 120 Q40 96 80 118 Q120 92 170 116 Q220 94 300 118 L300 140 L0 140 Z" fill="#0e1d2e" />
        <line x1="0" y1={GROUND} x2="300" y2={GROUND} stroke="#22384f" strokeWidth="2" />

        <Castle hp={wallHp} />
        <Army count={army} attacking={volley} />

        {/* panah melesat pas jawaban benar */}
        <AnimatePresence>
          {volley && [0, 1, 2].map((i) => (
            <motion.g key={i}
              initial={{ x: 0, opacity: 0 }}
              animate={{ x: 120, opacity: [0, 1, 1, 0], y: [-2, -14 - i * 4, -2] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.55, delay: i * 0.07, ease: 'easeOut' }}>
              <path d={`M150 ${GROUND - 22 - i * 6} l12 0`} stroke="#ffe08a" strokeWidth="2.4"
                strokeLinecap="round" />
              <path d={`M162 ${GROUND - 22 - i * 6} l-5 -3 l0 6 Z`} fill="#ffe08a" />
            </motion.g>
          ))}
        </AnimatePresence>

        {/* monster raksasa — makin sedikit HP makin nunduk */}
        <foreignObject x="196" y="8" width="104" height="118">
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'end center',
            opacity: dead ? 0.5 : 1 }}>
            <Monster seed={seed} size={100} color={color} mood={dead ? 'defeated' : mood} />
          </div>
        </foreignObject>

        {/* kepalan monster menghantam tembok */}
        <AnimatePresence>
          {shake && (
            <motion.g
              initial={{ opacity: 0, x: 60, y: -30, scale: 0.6 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 1.5 }}
              transition={{ duration: 0.25 }}>
              {/* titik benturan nempel di tembok, bukan melayang di langit */}
              <circle cx="94" cy="94" r="13" fill="#ffd166" opacity=".22" />
              <g stroke="#ffd166" strokeWidth="3" strokeLinecap="round">
                {[0, 60, 120, 180, 240, 300].map((a) => (
                  <line key={a} x1="94" y1="94"
                    x2={94 + 17 * Math.cos((a * Math.PI) / 180)}
                    y2={94 + 17 * Math.sin((a * Math.PI) / 180)} />
                ))}
              </g>
              <text x="94" y="74" textAnchor="middle" fontSize="16" fontWeight="900"
                fill="#ff8a7a" stroke="#2a0d0d" strokeWidth=".8" paintOrder="stroke">
                BRAK!
              </text>
            </motion.g>
          )}
        </AnimatePresence>
      </svg>

      {/* status singkat — biar user tahu taruhannya apa */}
      <div className="bt-status">
        {stage >= 3
          ? <span className="bt-warn">{lang === 'en' ? 'The kingdom has fallen!' : 'Kerajaan runtuh!'}</span>
          : stage === 2
            ? <span className="bt-warn">{lang === 'en' ? 'Walls are breaking — answer fast!' : 'Tembok mau jebol — jawab cepat!'}</span>
            : <span>{lang === 'en' ? `${army} troops ready` : `${army} pasukan siap tempur`}</span>}
      </div>
    </div>
  )
}
