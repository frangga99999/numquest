import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from './Icon.jsx'

const TYPE_MAP = {
  success:  { icon: 'ph:check-circle-fill',   color: 'var(--green)',  bg: 'rgba(62,201,138,.1)',  border: 'rgba(62,201,138,.3)' },
  reward:   { icon: 'ph:trophy-fill',          color: 'var(--gold)',   bg: 'rgba(244,185,66,.1)',  border: 'rgba(244,185,66,.3)' },
  warning:  { icon: 'ph:warning-fill',         color: '#ff9f6b',       bg: 'rgba(255,159,107,.1)', border: 'rgba(255,159,107,.3)' },
  info:     { icon: 'ph:info-fill',            color: 'var(--violet)', bg: 'rgba(141,123,255,.1)', border: 'rgba(141,123,255,.3)' },
  danger:   { icon: 'ph:x-circle-fill',        color: 'var(--red)',    bg: 'rgba(255,122,107,.1)', border: 'rgba(255,122,107,.3)' },
  milestone:{ icon: 'ph:star-fill',            color: 'var(--gold)',   bg: 'rgba(244,185,66,.12)', border: 'rgba(244,185,66,.4)' },
}

export default function Modal({ visible, type = 'info', title, body, actions, onClose, icon }) {
  const t = TYPE_MAP[type] || TYPE_MAP.info
  return (
    <AnimatePresence>
      {visible && (
        <motion.div className="modal-backdrop" style={{ zIndex: 70 }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose || (() => {})}>
          <motion.div className="gm-panel"
            initial={{ opacity: 0, scale: 0.88, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: 24 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}>
            {/* Decorative top bar */}
            <div className="gm-bar" style={{ background: t.color }} />

            {/* Icon */}
            <motion.div className="gm-icon"
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 18, delay: 0.08 }}>
              <Icon name={icon || t.icon} size={32} color={t.color} />
            </motion.div>

            {/* Content */}
            <div className="gm-body">
              {title && <h2 className="gm-title" style={{ color: t.color }}>{title}</h2>}
              {body && <p className="gm-text">{body}</p>}
            </div>

            {/* Actions */}
            {actions && actions.length > 0 && (
              <div className="gm-actions">
                {actions.map((a, i) => (
                  <button key={i} className={'gm-btn' + (a.primary ? ' gm-btn--primary' : '')}
                    style={a.color ? { color: a.color, borderColor: a.color } : {}}
                    onClick={a.onClick}>
                    {a.icon && <Icon name={a.icon} size={16} />}
                    {a.label}
                  </button>
                ))}
              </div>
            )}

            {/* Close button */}
            {onClose && (
              <button className="gm-close" onClick={onClose} aria-label="Tutup">
                <Icon name="x" size={18} />
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
