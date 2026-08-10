import React from 'react'
import { motion } from 'framer-motion'
import Icon from './Icon.jsx'

/* MVP component library — "Modern Kingdom War" aesthetic
 * All components are light wrappers around CSS classes defined in styles.css.
 */

// Panel with ornate golden top-border accent (same look as .card — kept as its own
// component so game screens read intentionally, but styling lives in .card once).
export function GamePanel({ className = '', children, glow, ...rest }) {
  return (
    <div className={`card ${glow ? 'glow' : ''} ${className}`} {...rest}>
      {children}
    </div>
  )
}

// Section title inside a panel
export function GameTitle({ children, icon, color = 'var(--gold)' }) {
  return (
    <div className="gp-title">
      {icon && <Icon name={icon} size={14} color={color} />}
      <span style={{ color }}>{children}</span>
    </div>
  )
}

// Top resource bar — shows up to 4 resources
export function ResourceBar({ items }) {
  return (
    <div className="resource-bar">
      {items.map(({ icon, value, color, label }) => (
        <div key={label} className="rp" title={label}>
          <Icon name={icon} size={16} color={color} />
          <span style={{ color: color || 'var(--ink)' }}>{value}</span>
        </div>
      ))}
    </div>
  )
}

// Primary game button (beveled, gold) — wraps .btn / .btn.soft
export function GameButton({ children, onClick, disabled, secondary, className = '' }) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={`btn ${secondary ? 'soft' : ''} ${className}`}
    >
      {children}
    </motion.button>
  )
}

// Compact rank/level badge
export function GameBadge({ label, color = 'var(--gold)', bg }) {
  return (
    <span className="game-badge" style={{ color, background: bg || 'rgba(244,185,66,.15)', borderColor: color }}>
      {label}
    </span>
  )
}

// Animated progress track (replaces bare .bar)
export function ProgressTrack({ value, color = 'var(--gold)', height = 10 }) {
  return (
    <div className="gp-track" style={{ height }}>
      <motion.div
        className="gp-track-fill"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(1, value) * 100}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        style={{ background: `linear-gradient(90deg, ${color}99, ${color})` }}
      />
    </div>
  )
}

// Compact accuracy/percentage ring — visual stand-in for a paragraph of stats
export function StatRing({ value, size = 60, color = 'var(--gold)', label }) {
  const R = (size - 8) / 2
  const C = 2 * Math.PI * R
  const cx = size / 2
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cx} r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth={6} />
        <motion.circle
          cx={cx} cy={cx} r={R} fill="none" stroke={color} strokeWidth={6} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
          initial={{ strokeDasharray: `0 ${C}` }}
          animate={{ strokeDasharray: `${C * Math.min(1, value)} ${C}` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
        <text x={cx} y={cx + 5} textAnchor="middle" fill={color} fontSize={size * 0.28} fontWeight="800">
          {Math.round(value * 100)}
        </text>
      </svg>
      {label && <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--dim)', letterSpacing: '.06em', textTransform: 'uppercase' }}>{label}</span>}
    </div>
  )
}

// Tier palette shared with Kingdom's building tiers (0 lahan kosong → 5 kristal)
const EMBLEM_TIERS = [
  { border: '#2a3a4d', fill: '#1a2c42', icon: 'var(--line)' },
  { border: '#a87847', fill: '#3a2410', icon: '#d8a26a' },
  { border: '#8a94a0', fill: '#262e38', icon: '#cfe0f0' },
  { border: '#b8c4d0', fill: '#303844', icon: '#e8f0f8' },
  { border: 'var(--gold)', fill: '#3a2c0a', icon: 'var(--gold)' },
  { border: 'var(--violet)', fill: '#1a1436', icon: '#c8bfff' },
]

// Hexagonal emblem badge — used for territory/domain icons
export function Emblem({ icon, level = 0, size = 44 }) {
  const t = EMBLEM_TIERS[Math.max(0, Math.min(5, level))]
  return (
    <div className="emblem" style={{ width: size, height: size, background: t.border, boxShadow: level >= 4 ? `0 0 12px ${t.border}66` : 'none' }}>
      <div className="emblem-inner" style={{ background: t.fill }}>
        <Icon name={icon} size={size * 0.42} color={t.icon} />
      </div>
    </div>
  )
}

// Divider with optional label
export function GameDivider({ label }) {
  return (
    <div className="gp-divider">
      {label && <span>{label}</span>}
    </div>
  )
}
