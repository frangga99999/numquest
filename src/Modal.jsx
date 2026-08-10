import React, { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from './Icon.jsx'

const TYPE_MAP = {
  success:  { icon: 'ph:check-circle-fill',   color: 'var(--green)',  bg: 'rgba(62,201,138,.1)',  border: 'rgba(62,201,138,.3)', glow: 'rgba(62,201,138,.25)' },
  reward:   { icon: 'ph:trophy-fill',          color: 'var(--gold)',   bg: 'rgba(244,185,66,.1)',  border: 'rgba(244,185,66,.3)',  glow: 'rgba(244,185,66,.3)' },
  warning:  { icon: 'ph:warning-fill',         color: '#ff9f6b',       bg: 'rgba(255,159,107,.1)', border: 'rgba(255,159,107,.3)', glow: 'rgba(255,159,107,.2)' },
  info:     { icon: 'ph:info-fill',            color: 'var(--violet)', bg: 'rgba(141,123,255,.1)', border: 'rgba(141,123,255,.3)', glow: 'rgba(141,123,255,.2)' },
  danger:   { icon: 'ph:x-circle-fill',        color: 'var(--red)',    bg: 'rgba(255,122,107,.1)', border: 'rgba(255,122,107,.3)', glow: 'rgba(255,122,107,.2)' },
  milestone:{ icon: 'ph:star-fill',            color: 'var(--gold)',   bg: 'rgba(244,185,66,.12)', border: 'rgba(244,185,66,.4)', glow: 'rgba(244,185,66,.35)' },
}

/* Particle burst positions — precomputed angles */
const PARTICLE_ANGLES = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2)
const CONFETTI_COLORS = ['#ffd060','#ff9f6b','#3ec98a','#8d7bff','#ff7a6b','#ffc86b','#5ec9ff','#ff85c0']

function particleStyle(angle, i, color) {
  const dist = 40 + (i % 3) * 18
  return {
    '--px': `${Math.cos(angle) * dist}px`,
    '--py': `${Math.sin(angle) * dist}px`,
    background: color,
    width: `${3 + (i % 3) * 2}px`,
    height: `${3 + (i % 3) * 2}px`,
  }
}

function confettiStyle(i, color) {
  const angle = (i / 20) * Math.PI * 2
  const dist = 55 + Math.random() * 35
  return {
    '--px': `${Math.cos(angle) * dist}px`,
    '--py': `${Math.sin(angle) * dist}px`,
    background: color,
    width: `${4 + Math.random() * 5}px`,
    height: `${3 + Math.random() * 4}px`,
  }
}

export default function Modal({ visible, type = 'info', title, body, actions, onClose, icon }) {
  const t = TYPE_MAP[type] || TYPE_MAP.info
  const particles = useMemo(() => PARTICLE_ANGLES.map((a, i) => particleStyle(a, i, t.color)), [t.color])
  const confetti = useMemo(() => Array.from({ length: 20 }, (_, i) => confettiStyle(i, CONFETTI_COLORS[i % CONFETTI_COLORS.length])), [])
  const showConfetti = type === 'success' || type === 'reward' || type === 'milestone'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div className="modal-backdrop" style={{ zIndex: 70 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose || (() => {})}>
          <motion.div className="gm-panel" style={{ '--gm-glow': t.glow, '--gm-icon-bg': t.bg, '--gm-icon-border': t.border }}
            initial={{ opacity: 0, scale: 0.82, y: 30, filter: 'blur(4px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.88, y: 20, filter: 'blur(2px)' }}
            transition={{ type: 'spring', stiffness: 360, damping: 28, mass: .8 }}
            onClick={(e) => e.stopPropagation()}>

            {/* Decorative top bar */}
            <div className="gm-bar" style={{ background: t.color }} />

            {/* Icon with glow ring */}
            <motion.div className="gm-icon"
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 16, delay: 0.06 }}>
              <motion.div className="gm-icon-ring" style={{ borderColor: t.color }}
                animate={{ scale: [1, 1.2, 1], opacity: [.5, .15, .5] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }} />
              <motion.div
                animate={{ rotate: [0, -8, 8, 0] }}
                transition={{ duration: .6, delay: .15 }}>
                <Icon name={icon || t.icon} size={32} color={t.color} />
              </motion.div>
            </motion.div>

            {/* Particle burst */}
            <div className="gm-particles">
              {particles.map((s, i) => (
                <motion.span key={i} className="gm-particle" style={s}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                  animate={{ x: s['--px'], y: s['--py'], opacity: 0, scale: 1 }}
                  transition={{ duration: .7, delay: .08 + i * .03, ease: 'easeOut' }} />
              ))}
              {/* Extra particles for success/reward */}
              {showConfetti && confetti.map((s, i) => (
                <motion.span key={`c${i}`} className="gm-confetti-piece" style={s}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
                  animate={{ x: s['--px'], y: s['--py'], opacity: 0, scale: 1, rotate: Math.random() * 360 }}
                  transition={{ duration: .9, delay: .12 + i * .04, ease: 'easeOut' }} />
              ))}
            </div>

            {/* Content */}
            <motion.div className="gm-body"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: .12, duration: .25 }}>
              {title && <h2 className="gm-title" style={{ color: t.color }}>{title}</h2>}
              {body && <p className="gm-text">{body}</p>}
            </motion.div>

            {/* Actions */}
            {actions && actions.length > 0 && (
              <motion.div className="gm-actions"
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: .18, duration: .25 }}>
                {actions.map((a, i) => (
                  <motion.button key={i} className={'gm-btn' + (a.primary ? ' gm-btn--primary' : '')}
                    style={a.color ? { color: a.color, borderColor: a.color } : {}}
                    whileTap={{ scale: .95 }}
                    onClick={a.onClick}>
                    {a.icon && <Icon name={a.icon} size={16} />}
                    {a.label}
                  </motion.button>
                ))}
              </motion.div>
            )}

            {/* Close button */}
            {onClose && (
              <motion.button className="gm-close" onClick={onClose} aria-label="Tutup"
                initial={{ opacity: 0, scale: .6 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: .2 }}
                whileHover={{ scale: 1.1 }} whileTap={{ scale: .9 }}>
                <Icon name="x" size={18} />
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
