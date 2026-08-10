import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from './Icon.jsx'
import { sfx } from './sound.js'
import { burst, bigWin } from './celebrate.js'
import { t, tf } from './i18n.js'

const DURATIONS = [
  { min: 10, labelKey: 'pomo.dur_10_label', descKey: 'pomo.dur_10_desc', icon: 'ph:fire-fill', color: '#ff9f6b' },
  { min: 15, labelKey: 'pomo.dur_15_label', descKey: 'pomo.dur_15_desc', icon: 'ph:lightning-fill', color: '#ffc86b' },
  { min: 25, labelKey: 'pomo.dur_25_label', descKey: 'pomo.dur_25_desc', icon: 'ph:timer-fill', color: 'var(--green)' },
  { min: 30, labelKey: 'pomo.dur_30_label', descKey: 'pomo.dur_30_desc', icon: 'ph:flask-fill', color: '#8d7bff' },
  { min: 45, labelKey: 'pomo.dur_45_label', descKey: 'pomo.dur_45_desc', icon: 'ph:anchor-fill', color: '#6bd5ff' },
]

const PENALTY = 50

function formatTime(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

/* ----------------------------- Setup ---------------------------------- */
function Setup({ onStart, onClose, lang }) {
  const [picked, setPicked] = useState(null)

  return (
    <motion.div className="pomo-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div className="pomo-setup" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 24 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}>

        <div className="pomo-setup-hero">
          <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 3, repeat: Infinity }}>
            <Icon name="ph:brain-fill" size={48} color="var(--gold)" />
          </motion.div>
          <h2>{t('pomo.setup_title', lang)}</h2>
          <p>{tf('pomo.setup_body', lang, { n: PENALTY })}</p>
        </div>

        <div className="pomo-durations">
          {DURATIONS.map((d) => (
            <motion.button key={d.min} whileTap={{ scale: 0.96 }}
              className={'pomo-dur' + (picked === d.min ? ' active' : '')}
              style={{ '--pc': d.color }}
              onClick={() => { setPicked(d.min); sfx.tap() }}>
              <Icon name={d.icon} size={22} color={d.color} />
              <b>{t(d.labelKey, lang)}</b>
              <span>{t(d.descKey, lang)}</span>
            </motion.button>
          ))}
        </div>

        <motion.button className="btn" disabled={!picked} whileTap={{ scale: 0.97 }}
          onClick={() => picked && onStart(picked)}>
          <Icon name="ph:play-fill" size={18} /> {picked ? tf('pomo.start', lang, { n: picked }) : t('pomo.start_fallback', lang)}
        </motion.button>

        <button className="btn ghost" onClick={onClose}>{t('pomo.later', lang)}</button>
      </motion.div>
    </motion.div>
  )
}

/* ----------------------------- Timer --------------------------------- */
function Timer({ totalSec, elapsed, running, lang }) {
  const R = 90
  const C = 2 * Math.PI * R
  const pct = totalSec > 0 ? Math.max(0, (totalSec - elapsed) / totalSec) : 1
  const left = totalSec - elapsed
  const cx = 110, cy = 110

  const color = left <= 60 ? 'var(--red)' : left <= totalSec * 0.25 ? 'var(--gold)' : 'var(--green)'

  return (
    <div className="pomo-ring-wrap">
      <svg width={220} height={220} viewBox={`0 0 ${cx * 2} ${cy * 2}`} className="pomo-ring-svg">
        {/* Glow behind */}
        <defs>
          <filter id="pomo-glow">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
        </defs>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={10} />
        <motion.circle cx={cx} cy={cy} r={R} fill="none" stroke={color} strokeWidth={10}
          strokeLinecap="round" filter="url(#pomo-glow)"
          strokeDasharray={`${C} ${C}`}
          strokeDashoffset={C * (1 - pct)}
          transform={`rotate(-90 ${cx} ${cy})`}
          animate={{ strokeDashoffset: C * (1 - pct) }}
          transition={{ duration: 1, ease: 'linear' }} />
        {/* Tick marks every 5 min */}
        {Array.from({ length: Math.ceil(totalSec / 300) }).map((_, i) => {
          const angle = (i * 300 / totalSec) * 360 - 90
          const rad = (angle * Math.PI) / 180
          const x1 = cx + (R - 16) * Math.cos(rad), y1 = cy + (R - 16) * Math.sin(rad)
          const x2 = cx + (R - 6) * Math.cos(rad), y2 = cy + (R - 6) * Math.sin(rad)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.15)" strokeWidth={2} strokeLinecap="round" />
        })}
      </svg>
      <div className="pomo-ring-center">
        <motion.span className="pomo-time" key={left} initial={{ scale: 1.1 }} animate={{ scale: 1 }}
          style={{ color }}>
          {formatTime(left)}
        </motion.span>
        <span className="pomo-status">{running ? t('pomo.timer_focus', lang) : left <= 0 ? t('pomo.timer_done', lang) : t('pomo.timer_pause', lang)}</span>
      </div>
    </div>
  )
}

/* ----------------------------- Main component ----------------------- */
export default function Pomodoro({ g, onDone, onClose }) {
  const [phase, setPhase] = useState('setup') // setup | running | done
  const [durationMin, setDurationMin] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [showQuit, setShowQuit] = useState(false)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef(null)
  const startRef = useRef(0)

  const totalSec = durationMin * 60

  // Cleanup timer on unmount
  useEffect(() => () => clearInterval(timerRef.current), [])

  const start = (min) => {
    setDurationMin(min)
    setPhase('running')
    setElapsed(0)
    startRef.current = Date.now()
    sfx.levelup()

    timerRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startRef.current) / 1000))
    }, 250)
  }

  // Check completion
  useEffect(() => {
    if (phase !== 'running' || elapsed < totalSec || totalSec === 0) return
    clearInterval(timerRef.current)
    setPhase('done')
    sfx.levelup()
    bigWin()
    burst({ particleCount: 80, spread: 100 })
  }, [elapsed, totalSec, phase])

  const confirmQuit = () => {
    clearInterval(timerRef.current)
    // Return penalty info to parent
    onDone({ quit: true, penalty: PENALTY, seconds: elapsed, durationMin })
  }

  const finish = () => {
    clearInterval(timerRef.current)
    onDone({ quit: false, seconds: Math.round(elapsed), durationMin, completed: elapsed >= totalSec })
  }

  if (phase === 'setup')
    return (
      <AnimatePresence>
        <Setup onStart={start} onClose={onClose} lang={g.lang} />
      </AnimatePresence>
    )

  const left = Math.max(0, totalSec - elapsed)

  return (
    <div className="pomo-screen">
      {/* Header */}
      <div className="pomo-head">
        <button className="ss-back" onClick={() => setShowQuit(true)} aria-label="Keluar">
          <Icon name="x" size={20} />
        </button>
        <span className="pomo-label">{t('pomo.running_label', g.lang)}</span>
        <span className="pomo-target">{durationMin}{t('pomo.min_abbr', g.lang)}</span>
      </div>

      {/* Timer */}
      <Timer totalSec={totalSec} elapsed={elapsed} running={!paused && phase === 'running'} lang={g.lang} />

      {/* Quote / tip */}
      <motion.div className="pomo-quote" key={phase}
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <Icon name="ph:quotes-fill" size={16} color="var(--gold)" />
        <span>
          {phase === 'running'
            ? t('pomo.quote_running', g.lang)
            : t('pomo.quote_done', g.lang)}
        </span>
      </motion.div>

      {/* Mini stats */}
      {phase === 'running' && (
        <div className="pomo-mini-stats">
          <div className="pomo-stat">
            <Icon name="ph:clock-fill" size={14} color="var(--dim)" />
            <span>{tf('pomo.left', g.lang, { n: formatTime(left) })}</span>
          </div>
          <div className="pomo-stat">
            <Icon name="ph:lightning-fill" size={14} color="#ffc86b" />
            <span>{tf('pomo.xp_bonus', g.lang, { n: Math.round(durationMin * 2) })}</span>
          </div>
        </div>
      )}

      {/* Done state */}
      {phase === 'done' && (
        <motion.div className="pomo-done" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 10 }}>
            <Icon name="ph:trophy-fill" size={64} color="var(--gold)" />
          </motion.div>
          <h2>{t('pomo.done_title', g.lang)}</h2>
          <p>{tf('pomo.done_body', g.lang, { n: durationMin })}</p>
          <div className="pomo-reward">
            <Icon name="ph:star-fill" size={18} color="var(--gold)" />
            <b>+{Math.round(durationMin * 2)} XP</b>
          </div>
          <button className="btn" onClick={finish}>{t('pomo.done_back', g.lang)}</button>
        </motion.div>
      )}

      {/* Quit confirmation modal */}
      <AnimatePresence>
        {showQuit && (
          <motion.div className="modal-backdrop" style={{ zIndex: 70 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowQuit(false)}>
            <motion.div className="ss-quit-modal" onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}>
              <div className="ss-quit-icon">
                <Icon name="ph:warning-fill" size={44} color="var(--red)" />
              </div>
              <h2>{t('pomo.quit_title', g.lang)}</h2>
              <p>{tf('pomo.quit_body', g.lang, { n: PENALTY })}</p>
              <p style={{ fontSize: 12 }}>{tf('pomo.quit_elapsed', g.lang, { min: Math.floor(elapsed / 60), sec: elapsed % 60 })}</p>
              <div className="ss-quit-btns">
                <button className="btn ghost" onClick={() => setShowQuit(false)}>
                  {t('pomo.quit_stay', g.lang)}
                </button>
                <button className="btn soft" onClick={confirmQuit}
                  style={{ background: 'linear-gradient(180deg, #5a2020, #2a1010)', border: '1px solid #6a3030', boxShadow: '0 4px 0 #1a0a0a' }}>
                  {tf('pomo.quit_go', g.lang, { n: PENALTY })}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
