import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import Icon from './Icon.jsx'
import { skillsOf, mastery, levelStatus, LEVELS, DOMAINS } from './engine.js'
import { last30, levelName } from './store.js'
import { t, tf } from './i18n.js'

const TIER_KEY = { locked: 'tier.locked', unlocked: 'tier.unlocked', bronze: 'tier.bronze', silver: 'tier.silver', gold: 'tier.gold' }
const TIER_COLOR = { locked: '#2a3a4d', unlocked: '#5a7a9a', bronze: '#c9803f', silver: '#c3d3e3', gold: 'var(--gold)' }
const HEAT_COLORS = ['rgba(255,255,255,.04)', 'rgba(62,201,138,.15)', 'rgba(62,201,138,.3)', 'rgba(62,201,138,.5)', 'rgba(62,201,138,.75)']

// Animated number using GSAP
function CountUp({ value, suffix = '', className, duration = 1.2 }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const o = { v: 0 }
    gsap.to(o, { v: value, duration, ease: 'power2.out', onUpdate: () => { el.textContent = Math.round(o.v) + suffix } })
  }, [value, suffix, duration])
  return <span ref={ref} className={className}>0{suffix}</span>
}

// Circular progress ring
function StatCircle({ value, max, color, icon, label, detail, delay = 0 }) {
  const R = 38
  const C = 2 * Math.PI * R
  const pct = max > 0 ? Math.min(1, value / max) : 0
  return (
    <motion.div className="pg-stat-circle"
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 200, damping: 22 }}>
      <svg width={90} height={90} viewBox="0 0 90 90">
        <circle cx={45} cy={45} r={R} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={5} />
        <motion.circle cx={45} cy={45} r={R} fill="none" stroke={color} strokeWidth={5}
          strokeLinecap="round" transform="rotate(-90 45 45)"
          initial={{ strokeDasharray: `0 ${C}` }}
          animate={{ strokeDasharray: `${C * pct} ${C}` }}
          transition={{ delay: delay + 0.3, duration: 1, ease: 'easeOut' }} />
        <text x={45} y={42} textAnchor="middle" fill="var(--ink)" fontSize={18} fontWeight="800"
          fontFamily="inherit">{icon ? <tspan><Icon name={icon} size={18} color={color} /></tspan> : null}</text>
      </svg>
      <div className="pg-stat-label">
        <span className="pg-stat-val" style={{ color }}><CountUp value={value} /></span>
        <span className="pg-stat-name">{label}</span>
        {detail && <span className="pg-stat-detail">{detail}</span>}
      </div>
    </motion.div>
  )
}

// Calendar heatmap day cell
function DayCell({ day, maxProblems }) {
  const [tapped, setTapped] = useState(false)
  const intensity = maxProblems > 0 ? Math.floor((day.problems / maxProblems) * 4) : 0
  const color = day.goalMet ? HEAT_COLORS[Math.max(2, intensity)] : HEAT_COLORS[intensity]
  const label = day.problems > 0 ? tf('progress.n_problems', 'id', { n: day.problems }) : t('progress.no_practice', 'id')
  return (
    <motion.div className="pg-day"
      style={{ background: color, border: day.goalMet ? '1px solid rgba(62,201,138,.25)' : '1px solid transparent' }}
      title={`${day.key}: ${label}`}
      onClick={() => setTapped(!tapped)}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
      animate={tapped ? { scale: [1, 1.2, 1], borderColor: ['transparent', 'var(--gold)', 'transparent'] } : {}}
      transition={{ duration: 0.4 }}>
      {day.goalMet && <span className="pg-day-dot" />}
    </motion.div>
  )
}

export default function Progress({ g }) {
  const days = last30(g)
  const max = Math.max(1, ...days.map((d) => d.problems))
  const st = levelStatus(g)
  const week = days.slice(-7)
  const weekMin = Math.round(week.reduce((a, d) => a + d.sec, 0) / 60)
  const weekAcc = week.reduce((a, d) => a + d.problems, 0)
    ? Math.round((week.reduce((a, d) => a + d.correct, 0) / week.reduce((a, d) => a + d.problems, 0)) * 100)
    : 0
  const skills = skillsOf(g.level)

  return (
    <div className="screen pg-screen">
      {/* ── Hero: 3 stat rings ──────────────────────────────────────────── */}
      <div className="pg-hero">
        <StatCircle value={g.streak} max={Math.max(g.streak, 30)} color="var(--gold)"
          icon="ph:lightning-fill" label={t('progress.streak', g.lang)} detail={tf('progress.best', g.lang, { n: g.bestStreak })} delay={0} />
        <StatCircle value={Math.round(st.acc * 100)} max={100} color="var(--green)"
          icon="ph:target-fill" label={t('progress.accuracy', g.lang)} detail={tf('misc.level', g.lang, { name: LEVELS[g.level].name })} delay={0.1} />
        <StatCircle value={g.xp} max={Math.max(g.xp, 10000)} color="var(--violet)"
          icon="ph:star-fill" label={t('progress.total_xp', g.lang)} detail={tf('progress.sessions_n', g.lang, { n: g.sessions })} delay={0.2} />
      </div>

      {/* ── Weekly summary strip ─────────────────────────────────────────── */}
      <motion.div className="pg-week"
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="pg-week-item">
          <Icon name="ph:timer-fill" size={18} color="var(--gold)" />
          <b>{weekMin}m</b>
          <span>{t('progress.week_7', g.lang)}</span>
        </div>
        <div className="pg-week-item">
          <Icon name="ph:check-circle-fill" size={18} color="var(--green)" />
          <b>{weekAcc}%</b>
          <span>{t('progress.precision', g.lang)}</span>
        </div>
        <div className="pg-week-item">
          <Icon name="ph:calendar-check-fill" size={18} color="var(--violet)" />
          <b>{days.filter((d) => d.goalMet).length}</b>
          <span>{t('progress.goals_met', g.lang)}</span>
        </div>
      </motion.div>

      {/* ── Calendar heatmap ─────────────────────────────────────────────── */}
      <motion.div className="card"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <div className="between" style={{ marginBottom: 12 }}>
          <h3>{t('progress.days_30', g.lang)}</h3>
          <div className="pg-legend">
            <span className="pg-legend-dot" style={{ background: HEAT_COLORS[0] }} />
            <span className="pg-legend-dot" style={{ background: HEAT_COLORS[2] }} />
            <span className="pg-legend-dot" style={{ background: HEAT_COLORS[4] }} />
            <small>{t('progress.legend', g.lang)}</small>
          </div>
        </div>
        <div className="pg-calendar">
          {days.map((d, i) => (
            <DayCell key={d.key} day={d} maxProblems={max} />
          ))}
        </div>
      </motion.div>

      {/* ── Level progress ────────────────────────────────────────────────── */}
      <motion.div className="card"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <div className="between" style={{ marginBottom: 8 }}>
          <h3>{tf('progress.level_at', g.lang, { name: LEVELS[g.level].name })}</h3>
          <GameBadge label={LEVELS[g.level].title} color="var(--gold)" bg="rgba(244,185,66,.1)" />
        </div>
        <p style={{ marginBottom: 14 }}>{levelName(g.level)}</p>

        {/* Progress bars with milestone markers */}
        <div className="pg-level-bars">
          {[
            { label: t('progress.precision', g.lang), val: st.acc, target: 0.85, icon: 'ph:target-fill', color: 'var(--green)' },
            { label: t('kingdom.gold_skills', g.lang), val: st.goldPct, target: 0.7, icon: 'ph:medal-fill', color: 'var(--gold)' },
            { label: 'Hari latihan', val: st.days / st.need, target: 1, icon: 'ph:calendar-fill', color: 'var(--violet)', detail: `${st.days}/${st.need}` },
          ].map((item, idx) => (
            <div key={item.label} className="pg-level-row">
              <div className="pg-level-head">
                <Icon name={item.icon} size={16} color={item.color} />
                <span className="pg-level-label">{item.label}</span>
                <span className="pg-level-num" style={{ color: item.color }}>
                  {item.detail || `${Math.round(item.val * 100)}%`}
                </span>
              </div>
              <div className="pg-level-track">
                <motion.i
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (item.val / item.target) * 100)}%` }}
                  transition={{ delay: 0.6 + idx * 0.15, duration: 0.8, ease: 'easeOut' }}
                  style={{ background: item.color }} />
                {/* Target marker */}
                <div className="pg-level-marker" style={{ left: `${item.target * 100}%` }} />
              </div>
            </div>
          ))}
        </div>

        {st.ready && (
          <motion.div className="pg-ready"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.8 }}>
            <Icon name="ph:arrow-circle-up-fill" size={24} color="var(--gold)" />
            <span>{t('progress.ready_up', g.lang)}</span>
          </motion.div>
        )}
      </motion.div>

      {/* ── Skill tree ────────────────────────────────────────────────────── */}
      <h3>{t('progress.skill_map', g.lang)}</h3>
      <motion.div className="card pg-skills"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        {skills.map((s, idx) => {
          const m = mastery(g.skills?.[s.id])
          const d = DOMAINS[s.domain]
          return (
            <motion.div key={s.id} className="pg-skill"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + idx * 0.05 }}>
              {/* Tier ring */}
              <div className="pg-skill-ring" style={{ borderColor: TIER_COLOR[m.tier] }}>
                <Icon name={d.icon} size={15} color={TIER_COLOR[m.tier]} />
                {m.tier === 'gold' && (
                  <motion.div className="pg-skill-glow"
                    animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.15, 1] }}
                    transition={{ duration: 2, repeat: Infinity }} />
                )}
              </div>

              {/* Skill info */}
              <div className="pg-skill-body">
                <div className="pg-skill-top">
                  <b>{s.name}</b>
                  <motion.span className="pg-skill-tier" style={{ color: TIER_COLOR[m.tier] }}
                    animate={m.tier === 'gold' ? { textShadow: ['0 0 0 rgba(244,185,66,0)', '0 0 8px rgba(244,185,66,.5)', '0 0 0 rgba(244,185,66,0)'] } : {}}
                    transition={{ duration: 2, repeat: Infinity }}>
                    {t(TIER_KEY[m.tier], g.lang)}
                  </motion.span>
                </div>

                {/* Mini progress */}
                <div className="pg-skill-bar">
                  <motion.i
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.round(m.acc * 100)}%` }}
                    transition={{ delay: 0.7 + idx * 0.05, duration: 0.6, ease: 'easeOut' }}
                    style={{ background: m.tier === 'gold' ? 'var(--gold)' : TIER_COLOR[m.tier] }} />
                </div>

                <small>{m.n > 0 ? tf('progress.of_total', g.lang, { pct: Math.round(m.acc * 100), n: m.n }) : t('progress.no_data', g.lang)}</small>
              </div>
            </motion.div>
          )
        })}
      </motion.div>

      <small className="center">{t('progress.skill_fade', g.lang)}</small>
    </div>
  )
}

// Local badge component (thin, don't need full GameBadge import chain)
function GameBadge({ label, color, bg }) {
  return (
    <span className="pg-badge" style={{ color, background: bg || 'rgba(255,255,255,.06)', borderColor: color + '44' }}>
      {label}
    </span>
  )
}
