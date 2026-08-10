import React, { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import Icon from './Icon.jsx'
import Session from './Session.jsx'
import Kingdom from './Kingdom.jsx'
import Progress from './Progress.jsx'
import Clan from './Clan.jsx'
import Arena from './Arena.jsx'
import AIPath from './AIPath.jsx'
import Shop from './Shop.jsx'
import Learn from './Learn.jsx'
import { AI_PATH, nodeStatus, pathProgress, clearPathNode, starsFor, NODE_PROBLEM_COUNT } from './aiPath.js'
import { useGame, blank, goalProgress, levelName, finishSession, heartsNow, energyNow, claimQuest, isClaimed, push, shopItem, last30 } from './store.js'
import { newProblem, buildSession, fmt, parseNum, LEVELS, nextLevel, buildingLevels, DOMAINS, levelStatus, dayKey, skillById, rankFor, challengeTarget } from './engine.js'
import { dailyPlan, DIAGNOSTIC, placeLevel, flavorSession, challengeProblems } from './ai.js'
import { GamePanel, GameTitle, ResourceBar, GameButton, GameBadge, ProgressTrack, Emblem } from './GameUI.jsx'
import Modal from './Modal.jsx'
import { sfx } from './sound.js'
import { burst, bigWin } from './celebrate.js'
import { questProgress, questDone, QUEST_KINDS } from './quests.js'
import { api, loggedIn, checkAiOnline, aiOnline } from './api.js'
import { t, tf, LANGS } from './i18n.js'

// Ambil kalimat pertama saja — panel pelatih harus 80% visual, bukan esai.
const oneLine = (s) => (s || '').split(/(?<=[.!?])\s/)[0]?.slice(0, 90) || ''

const GOALS = [5, 10, 15, 20, 30, 45, 60]
const FOCUS_DURATIONS = [
  { min: 10, icon: 'ph:fire-fill', color: '#ff9f6b' },
  { min: 15, icon: 'ph:lightning-fill', color: '#ffc86b' },
  { min: 25, icon: 'ph:timer-fill', color: 'var(--green)' },
]
const DAY_LETTER = ['M', 'S', 'S', 'R', 'K', 'J', 'S'] // Minggu..Sabtu
// Warna emblem avatar ikut tingkat: dasar=batu, menengah=besi, mahir=emas
const LEVEL_TIER = { easy: 2, mid: 3, adv: 4 }
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del']

// Pilihan fokus domain — ikon pakai Phosphor (ph:) dari Iconify
const FOCUS_OPTIONS = [
  { id: null,  labelKey: 'focus.all', icon: 'ph:circles-four-fill',   color: 'var(--gold)' },
  { id: 'add', labelKey: 'focus.add', icon: 'ph:plus-circle-fill',    color: 'var(--op-add)' },
  { id: 'sub', labelKey: 'focus.sub', icon: 'ph:minus-circle-fill',   color: 'var(--op-sub)' },
  { id: 'mul', labelKey: 'focus.mul', icon: 'ph:x-circle-fill',       color: 'var(--op-mul)' },
  { id: 'div', labelKey: 'focus.div', icon: 'ph:divide-fill',         color: 'var(--op-div)' },
  { id: 'frac',labelKey: 'focus.frac',icon: 'ph:percent-fill',        color: '#ff9f6b' },
]

const Keypad = ({ onKey }) => (
  <div className="keypad">
    {KEYS.map((k) => (
      <motion.button key={k} className="key" whileTap={{ scale: 0.9 }} onClick={() => onKey(k)} aria-label={k === 'del' ? 'Hapus' : k}>
        {k === 'del' ? <Icon name="rotate-ccw" size={20} /> : k}
      </motion.button>
    ))}
  </div>
)

/* ------------------------------- Focus Picker ----------------------------- */
function FocusPicker({ visible, selected, onSelect, onStart, label, lang }) {
  if (!visible) return null
  return (
    <motion.div className="focus-sheet"
      initial={{ opacity: 0, y: 80, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 80, filter: 'blur(3px)' }}
      transition={{ type: 'spring', stiffness: 320, damping: 30, mass: .9 }}>
        <motion.h3 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: .08 }}>{label || t('focus.title', lang)}</motion.h3>
        <div className="focus-grid">
          {FOCUS_OPTIONS.map((opt, i) => (
            <motion.button key={String(opt.id)} whileTap={{ scale: 0.93 }}
              className={'focus-card' + (selected === opt.id ? ' active' : '')}
              style={{ '--fc': opt.color }}
              initial={{ opacity: 0, y: 24, scale: .9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: .1 + i * .08, type: 'spring', stiffness: 340, damping: 24 }}
              onClick={() => onSelect(opt.id)}>
              <motion.div
                animate={selected === opt.id ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: .5 }}>
                <Icon name={opt.icon} size={36} />
              </motion.div>
              <b style={{ color: selected === opt.id ? 'var(--ink)' : 'var(--dim)' }}>{t(opt.labelKey, lang)}</b>
            </motion.button>
          ))}
        </div>
        <motion.button className="btn" style={{ marginTop: 16 }} whileTap={{ scale: 0.97 }} onClick={onStart}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35 }}>
          <Icon name="ph:play-fill" size={18} /> {t('home.cta_start', lang || 'id')}
        </motion.button>
    </motion.div>
  )
}

/* ------------------------------- Onboarding ------------------------------ */
function Onboarding({ onDone }) {
  const [step, setStep] = useState(0)
  const [goal, setGoal] = useState(5)
  const [qs] = useState(() => DIAGNOSTIC.map((id) => newProblem(id)))
  const [qi, setQi] = useState(0)
  const [res, setRes] = useState({})
  const [input, setInput] = useState('')

  const answer = (val) => {
    const p = qs[qi]
    const given = typeof p.answer === 'string' ? val : parseNum(val)
    setRes({ ...res, [p.skill]: given === p.answer })
    setInput('')
    if (qi + 1 < qs.length) setQi(qi + 1)
    else setStep(3)
  }

  if (step === 0)
    return (
      <div className="screen" style={{ justifyContent: 'center' }}>
        <motion.div className="center" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 12 }}>
          <Icon name="ph:castle-turret-fill" size={80} color="var(--gold)" />
        </motion.div>
        <h1 className="center" style={{ fontSize: 32 }}>{t('onb.title', 'id')}</h1>
        <p className="center">{t('onb.subtitle', 'id')}</p>
        <button className="btn" onClick={() => setStep(1)}>{t('onb.cta', 'id')}</button>
      </div>
    )

  if (step === 1)
    return (
      <div className="screen" style={{ justifyContent: 'center' }}>
        <Icon name="ph:timer-fill" size={52} color="var(--gold)" style={{ alignSelf: 'center' }} />
        <h1>{t('onb.goal_question', 'id')}</h1>
        <p>{t('onb.goal_hint', 'id')}</p>
        <div className="grid g3" style={{ marginTop: 8 }}>
          {GOALS.map((m) => <button key={m} className="chip" aria-pressed={goal === m} onClick={() => setGoal(m)}>{m} menit</button>)}
        </div>
        <div className="grow" />
        <button className="btn" onClick={() => setStep(2)}>{t('onb.continue', 'id')} <Icon name="chevron-right" size={18} /></button>
      </div>
    )

  if (step === 2) {
    const p = qs[qi]
    return (
      <div className="screen">
        <div className="bar"><i style={{ width: `${(qi / qs.length) * 100}%` }} /></div>
        <p>{t('onb.diag_hint', 'id')}</p>
        <AnimatePresence mode="wait">
          <motion.div key={qi} className="card stack" style={{ gap: 16 }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className={'problem' + (p.text.length > 34 ? ' word' : '')}>{p.text}</div>
            {p.display && <div className="problem">{p.display}</div>}
            {p.choices ? (
              <div className="grid g2">
                {p.choices.map((c) => (
                  <motion.button key={String(c)} className="opt" whileTap={{ scale: 0.94 }} onClick={() => answer(String(c))}>
                    {typeof c === 'number' ? fmt(c) : c}
                  </motion.button>
                ))}
              </div>
            ) : (
              <>
                <div className="answer-box">{input || '—'}</div>
                <Keypad onKey={(k) => setInput((s) => (k === 'del' ? s.slice(0, -1) : s.length < 7 ? s + k : s))} />
                <button className="btn" disabled={!input} onClick={() => answer(input)}>{t('onb.answer', 'id')}</button>
              </>
            )}
          </motion.div>
        </AnimatePresence>
        <button className="btn ghost" onClick={() => answer(' ')}>{t('onb.skip', 'id')}</button>
      </div>
    )
  }

  const level = placeLevel(res)
  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      <motion.div className="center" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
        <Icon name="ph:map-trifold-fill" size={72} color="var(--gold)" />
      </motion.div>
      <h1 className="center">{t('onb.result_title', 'id')}</h1>
      <div className="card center">
        <h2>{levelName(level)}</h2>
        <p style={{ marginTop: 8 }}>
          {level === 'easy' && t('onb.result_body_easy', 'id')}
          {level === 'mid' && t('onb.result_body_mid', 'id')}
          {level === 'adv' && t('onb.result_body_adv', 'id')}
        </p>
      </div>
      <p className="center">{tf('onb.result_goal', 'id', { n: goal })}</p>
      <div className="grow" />
      <button className="btn" onClick={() => onDone({ level, goalMin: goal })}>{t('onb.enter', 'id')}</button>
    </div>
  )
}

/* --------------------------------- Akun ---------------------------------- */
function Auth({ g, setG, onClose }) {
  const [mode, setMode] = useState('register')
  const [f, setF] = useState({ email: '', password: '', handle: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const go = async () => {
    setBusy(true); setErr('')
    try {
      const r = mode === 'register'
        ? await api.register({ ...f, state: g })
        : await api.login({ email: f.email, password: f.password })
      const merged = (r.state?.xp || 0) > g.xp ? { ...g, ...r.state } : g
      setG({ ...merged, handle: r.user.handle, clanId: r.user.clanId, plan: null })
      if ((r.state?.xp || 0) <= g.xp) api.putState(g).catch(() => {})
      onClose()
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="screen">
      <div className="between">
        <h1>{mode === 'register' ? t('auth.register', g.lang) : t('auth.login', g.lang)}</h1>
        <button className="pill icon-btn" onClick={onClose}><Icon name="x" size={18} /></button>
      </div>
      <p>{t('auth.desc', g.lang)}</p>
      <div className="card stack">
        {mode === 'register' && (
          <input className="input" placeholder={t('auth.handle', g.lang)} value={f.handle} maxLength={16}
            onChange={(e) => setF({ ...f, handle: e.target.value })} autoComplete="username" />
        )}
        <input className="input" type="email" placeholder={t('auth.email', g.lang)} value={f.email}
          onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />
        <input className="input" type="password" placeholder={t('auth.password', g.lang)} value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          onKeyDown={(e) => e.key === 'Enter' && go()} />
        {err && <div className="err row" style={{ gap: 8 }}><Icon name="alert-circle" size={17} /> {err}</div>}
        <button className="btn" disabled={busy || !f.email || !f.password} onClick={go}>
          {busy ? t('auth.busy', g.lang) : mode === 'register' ? t('auth.register', g.lang) : t('auth.login', g.lang)}
        </button>
      </div>
      <button className="btn ghost" onClick={() => { setMode(mode === 'register' ? 'login' : 'register'); setErr('') }}>
        {mode === 'register' ? t('auth.has_account', g.lang) : t('auth.no_account', g.lang)}
      </button>
      <small className="center">{t('auth.privacy', g.lang)}</small>
    </div>
  )
}

/* ------------------------------- Tugas harian ---------------------------- */
const QUEST_META = {
  problems:  { icon: 'ph:stack-fill',        color: '#f4b942', labelKey: 'quests.kind_problems' },
  correct:   { icon: 'ph:check-circle-fill',  color: '#3ec98a', labelKey: 'quests.kind_correct' },
  fast:      { icon: 'ph:lightning-fill',     color: '#ffc86b', labelKey: 'quests.kind_fast' },
  combo:     { icon: 'ph:flame-fill',         color: '#ff6b6b', labelKey: 'quests.kind_combo' },
  minutes:   { icon: 'ph:timer-fill',         color: '#8d7bff', labelKey: 'quests.kind_minutes' },
  domain:    { icon: 'ph:target-fill',        color: '#ff9f6b', labelKey: 'quests.kind_domain' },
  variant:   { icon: 'ph:shuffle-fill',       color: '#60cfff', labelKey: 'quests.kind_variant' },
}

function QuestList({ g, setG, plan }) {
  const day = g.days[dayKey()]
  const quests = plan?.quests || []
  if (!quests.length) return <p style={{ fontSize: 13 }}>{t('quests.loading', (g || {}).lang)}</p>
  return (
    <div className="stack">
      {quests.map((q, i) => {
        const pr = questProgress(q, day)
        const done = questDone(q, day)
        const claimed = isClaimed(g, q)
        const meta = QUEST_META[q.kind] || QUEST_META.problems
        const cur = Math.min(q.target, QUEST_KINDS[q.kind]?.of(day || {}, q) || 0)
        return (
          <motion.div key={q.id} layout
            className={`dq-card ${done ? 'dq-card--done' : ''} ${claimed ? 'dq-card--claimed' : ''}`}
            style={{ '--dq-color': meta.color }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}>
            <div className="dq-row">
              <span className="dq-icon" style={{ background: `${meta.color}18`, borderColor: `${meta.color}33` }}>
                <Icon name={meta.icon} size={18} color={meta.color} />
              </span>
              <div className="dq-body">
                <div className="dq-head">
                  <b className="dq-title">{q.title}</b>
                  {claimed
                    ? <span className="dq-claimed"><Icon name="check" size={13} /> {t('quests.claimed', g.lang)}</span>
                    : done
                      ? <motion.button className="dq-claim"
                          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.93 }}
                          onClick={() => { sfx.coin(); burst({ particleCount: 30, spread: 50 }); setG(claimQuest(g, q)) }}>
                          <Icon name="ph:gift-fill" size={13} /> +{q.reward.xp} XP
                        </motion.button>
                      : <span className="dq-pct">{Math.round(pr * 100)}%</span>}
                </div>
                <div className="dq-track-wrap">
                  <div className="dq-track">
                    <motion.div className="dq-track-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(1, pr) * 100}%` }}
                      style={{ background: done ? `linear-gradient(90deg, ${meta.color}88, ${meta.color})` : `linear-gradient(90deg, ${meta.color}44, ${meta.color})` }} />
                  </div>
                  <span className="dq-stat">{cur}/{q.target} <span className="dq-kind-label">{QUEST_KINDS[q.kind]?.label}</span></span>
                </div>
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// kept for backward compat (other code paths)
function Quests({ g, setG, plan }) {
  return <QuestList g={g} setG={setG} plan={plan} />
}

/* ------------------------------ Maskot AI --------------------------------- */
// Karakter kecil yang "hidup" — mengambang pelan, mata berkedip, senyum kalau
// akurasi bagus. Ini pengganti StatRing + paragraf panjang: satu makhluk yang
// kelihatan lagi ngomong, bukan kartu data.
const popVariant = { hidden: { opacity: 0, scale: 0.5, y: 6 }, show: { opacity: 1, scale: 1, y: 0 } }

function AiMascot({ size = 76, happy }) {
  return (
    <motion.div className="mascot" style={{ width: size, height: size }}
      animate={{ y: [0, -5, 0], rotate: [0, -2, 2, 0] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <radialGradient id="mascotBody" cx="35%" cy="28%">
            <stop offset="0%" stopColor="#b0a4ff" />
            <stop offset="100%" stopColor="#6f5bef" />
          </radialGradient>
          <filter id="mascotGlow"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {/* antena */}
        <line x1="50" y1="20" x2="50" y2="9" stroke="#8d7bff" strokeWidth="3" strokeLinecap="round" />
        <motion.circle cx="50" cy="7" r="4.2" fill="#ffd060" filter="url(#mascotGlow)"
          animate={{ opacity: [0.55, 1, 0.55] }} transition={{ duration: 1.6, repeat: Infinity }} />
        {/* badan */}
        <rect x="16" y="20" width="68" height="66" rx="27" fill="url(#mascotBody)" stroke="#6f5bef" strokeWidth="2" />
        {/* pipi */}
        <circle cx="27" cy="60" r="5" fill="#ff9fd0" opacity="0.4" />
        <circle cx="73" cy="60" r="5" fill="#ff9fd0" opacity="0.4" />
        {/* mata — berkedip berkala */}
        <motion.g animate={{ scaleY: [1, 1, 0.08, 1, 1, 1, 1] }}
          transition={{ duration: 4, repeat: Infinity, times: [0, 0.86, 0.9, 0.94, 0.97, 0.985, 1] }}
          style={{ transformOrigin: '50px 50px' }}>
          <circle cx="37" cy="50" r="6.5" fill="#fff" />
          <circle cx="63" cy="50" r="6.5" fill="#fff" />
          <circle cx={happy ? 38.5 : 37} cy="50" r="3.2" fill="#241c50" />
          <circle cx={happy ? 64.5 : 63} cy="50" r="3.2" fill="#241c50" />
        </motion.g>
        {/* mulut */}
        {happy ? (
          <path d="M40 65 Q50 73 60 65" stroke="#241c50" strokeWidth="3" strokeLinecap="round" fill="none" />
        ) : (
          <rect x="43" y="65" width="14" height="3.5" rx="1.75" fill="#241c50" opacity="0.75" />
        )}
      </svg>
    </motion.div>
  )
}

/* --------------------------------- Home ---------------------------------- */
function Home({ g, setG, plan, onStartPicker, onChallengePicker, onOpenPath, onOpenShop, onFocus, onSettings }) {
  const prog = goalProgress(g)
  const lv = buildingLevels(g)
  const st = levelStatus(g)
  const xpRef = useRef(null)
  const ai = plan?.coach
  const ch = plan?.challenge
  const chDone = g.challengeDone === dayKey()
  const week = last30(g).slice(-7)

  useEffect(() => {
    if (g.reducedMotion || !xpRef.current) return
    const o = { v: 0 }
    gsap.to(o, { v: g.xp, duration: 1, ease: 'power2.out', onUpdate: () => { if (xpRef.current) xpRef.current.textContent = Math.round(o.v) } })
  }, [g.xp, g.reducedMotion])

  return (
    <div className="screen">

      {/* Resource bar */}
      <ResourceBar items={[
        { icon: 'ph:lightning-fill', value: g.streak, color: 'var(--gold)', label: t('home.streak', g.lang) },
        { icon: 'ph:star-fill', value: <span ref={xpRef}>{g.xp}</span>, color: 'var(--violet)', label: t('home.xp', g.lang) },
        { icon: 'ph:coin-fill', value: g.coins, color: '#ffc86b', label: t('home.coins', g.lang) },
        { icon: 'ph:flask-fill', value: energyNow(g), color: '#3ec98a', label: t('home.bonus', g.lang) },
        { icon: 'ph:heart-fill', value: g.hearts, color: 'var(--red)', label: t('home.hearts', g.lang) },
      ]} />

      {/* Player banner */}
      <div className="player-banner">
        <div className="hero-row">
          <Emblem icon="ph:user-fill" level={LEVEL_TIER[g.level]} size={54} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="player-name">{g.handle || t('player.default', g.lang)}</div>
            <div className="player-title">{levelName(g.level)}</div>
          </div>
          <div className="row" style={{ gap: 8 }}>
            {ai?.canAdvance && <GameBadge label="Naik!" color="var(--green)" />}
            <button className="pill icon-btn" onClick={onSettings} aria-label={t('settings.title', g.lang)}>
              <Icon name="settings" size={18} />
            </button>
          </div>
        </div>

        {/* 7 hari terakhir — timeline nodes */}
        <div className="week-strip">
          {week.map((d, k) => {
            const date = new Date(d.key)
            const isToday = d.key === dayKey()
            const dayNum = date.getDate()
            return (
              <motion.div key={d.key}
                className={'week-day' + (d.goalMet ? ' met' : d.problems ? ' partial' : '') + (isToday ? ' today' : '')}
                initial={{ opacity: 0, y: 12, scale: .8 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: .15 + k * .06, type: 'spring', stiffness: 340, damping: 24 }}>
                <span className="week-dot">
                  {d.goalMet ? <Icon name="check" size={14} /> : dayNum}
                </span>
                <small>{DAY_LETTER[(date.getDay() + 7) % 7]}</small>
              </motion.div>
            )
          })}
        </div>

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="between" style={{ marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--dim)' }}>{t('home.target_today', g.lang)}</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: prog >= 1 ? 'var(--green)' : 'var(--gold)' }}>{Math.round(prog * 100)}%</span>
          </div>
          <ProgressTrack value={prog} color={prog >= 1 ? 'var(--green)' : 'var(--gold)'} height={12} />
        </div>
      </div>

      {/* Tombol mulai */}
      <div className="start-block">
        <GameButton onClick={onStartPicker}>
          <Icon name={prog >= 1 ? 'ph:plus-circle-fill' : 'ph:play-circle-fill'} size={24} />
          {prog >= 1 ? t('home.cta_bonus', g.lang) : t('home.cta_start', g.lang)}
        </GameButton>
        {/* Visual energy orbs — ganti teks deskripsi */}
        <div className="energy-pips">
          {Array.from({ length: Math.min(5, energyNow(g)) }).map((_, i) => (
            <motion.span key={i} className="energy-pip active"
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 400 }}>
              <Icon name="ph:flask-fill" size={15} color="#3ec98a" />
            </motion.span>
          ))}
          {energyNow(g) === 0 && (
            <span className="energy-empty">
              <Icon name="ph:flask-fill" size={15} color="var(--dim)" />
              <small style={{ color: 'var(--dim)', fontWeight: 600 }}>{t('home.energy_out', g.lang)}</small>
            </span>
          )}
        </div>
      </div>

      {/* ── Tablet: 2‑column layout. Mobile: stacks naturally ───────── */}
      <div className="home-cols">
        <div className="home-col-left">

      {/* Aksi cepat — 3 kartu game-HUD bersih */}
      <div className="quick-grid">
        <motion.button className="quick-card quick-card--path" onClick={onOpenPath} whileTap={{ scale: 0.96 }}>
          <span className="qc-icon-circle" style={{ borderColor: 'var(--violet)' }}>
            <Icon name="ph:robot-fill" size={24} color="var(--violet)" />
          </span>
          <div className="qc-progress-bar">
            <motion.div className="qc-progress-bar-fill"
              style={{ background: 'var(--violet)' }}
              initial={{ width: '0%' }}
              animate={{ width: `${Math.min(100, (pathProgress(g).done / Math.max(1, pathProgress(g).total)) * 100)}%` }}
              transition={{ duration: .8, ease: 'easeOut' }} />
          </div>
          <b>{t('path.card_title', g.lang)}</b>
          <span className="qc-metric" style={{ color: 'var(--violet)' }}>{pathProgress(g).done}/{pathProgress(g).total}</span>
        </motion.button>

        <motion.button className="quick-card quick-card--pomo" onClick={onFocus} whileTap={{ scale: 0.96 }}>
          <span className="qc-icon-circle" style={{ borderColor: '#ff9f6b' }}>
            <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 2.5, repeat: Infinity }}>
              <Icon name="ph:brain-fill" size={24} color="#ff9f6b" />
            </motion.div>
          </span>
          <b>{t('home.action_focus', g.lang)}</b>
          <span className="qc-metric" style={{ color: '#ff9f6b' }}>
            <Icon name="ph:timer-fill" size={10} /> +XP
          </span>
        </motion.button>

        <motion.button className="quick-card quick-card--shop" onClick={onOpenShop} whileTap={{ scale: 0.96 }}>
          <span className="qc-icon-circle" style={{ borderColor: '#ffc86b' }}>
            <Icon name="ph:coin-fill" size={24} color="#ffc86b" />
          </span>
          <b>{t('shop.card_title', g.lang)}</b>
          <span className="qc-metric" style={{ color: '#ffc86b' }}>{g.coins}</span>
        </motion.button>
      </div>

      {/* Kerajaan mini — tablet: di kolom kiri */}
      <GamePanel>
        <div className="between" style={{ marginBottom: 2 }}>
          <GameTitle icon="ph:buildings-fill" color="#a0c8ff">{t('kingdom.title', g.lang)}</GameTitle>
          <GameBadge label={`${Object.values(lv).reduce((a, b) => a + b, 0)}/50`} color="var(--dim)" bg="rgba(255,255,255,.06)" />
        </div>
        <div className="gp-territory">
          {Object.entries(DOMAINS).map(([id, d]) => (
            <div key={id} className="gp-territory-item" title={d.region}>
              <Emblem icon={lv[id] ? d.icon : 'lock'} level={lv[id]} size={44} />
              <div className="gp-territory-bar">
                <span style={{ width: `${(lv[id] / 5) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </GamePanel>

        </div>{/* /home-col-left */}
        <div className="home-col-mid">

      {/* Pelatih AI — playful companion */}
      {ai && (
        <motion.div className="coach-playful" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="coach-playful-inner">
            <div className="cp-mascot-area">
              <AiMascot happy={st.acc >= 0.85} />
              {/* Sparkle particles around mascot */}
              <motion.span className="cp-sparkle" style={{ top: -2, left: 12 }}
                animate={{ opacity: [0, 1, 0], scale: [0.3, 1, 0.3], y: [-2, -10] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: 0 }}>✦</motion.span>
              <motion.span className="cp-sparkle" style={{ top: 8, right: 4 }}
                animate={{ opacity: [0, 1, 0], scale: [0.3, 1, 0.3], y: [4, -6] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: 0.7 }}>✧</motion.span>
              <motion.span className="cp-sparkle" style={{ bottom: 4, left: 16 }}
                animate={{ opacity: [0, 1, 0], scale: [0.3, 1, 0.3], y: [2, -8] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: 1.2 }}>⋆</motion.span>
            </div>

            <div className="cp-bubble-area">
              <motion.div className="cp-bubble"
                initial={{ opacity: 0, scale: 0.88, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 22, delay: 0.15 }}>
                <div className="cp-bubble-head">
                  <span className="cp-bubble-role">
                    {plan.source === 'ai' ? t('coach.title_ai', g.lang) : t('coach.title_local', g.lang)}
                    <span className="ai-dot" data-online={aiOnline() ? '1' : '0'} />
                  </span>
                  {ai?.canAdvance && <span className="cp-levelup-badge">⬆ Naik!</span>}
                </div>
                <p className="cp-bubble-msg">{oneLine(ai.message)}</p>
              </motion.div>

              <div className="cp-stat-row">
                <span className="cp-stat" style={{ '--cs': st.acc >= 0.85 ? 'var(--green)' : 'var(--gold)' }}>
                  <Icon name="ph:target-fill" size={12} /> {Math.round(st.acc * 100)}%
                </span>
                {(ai.focus || []).slice(0, 3).map((id) => {
                  const s = skillById[id]
                  if (!s) return null
                  const d = DOMAINS[s.domain]
                  return (
                    <span key={id} className="cp-stat" style={{ '--cs': 'var(--gold)' }} title={s.name}>
                      <Icon name={d.icon} size={12} />
                    </span>
                  )
                })}
                <span className="cp-stat" style={{ '--cs': 'var(--dim)' }}>
                  <Icon name="ph:list-numbers-fill" size={12} /> {ai.sessionCount || 12}
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

        </div>{/* /home-col-mid */}
        <div className="home-col-right">

      {/* Tantangan harian */}
      {ch && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <GamePanel glow={!chDone}>
            <div className="between" style={{ marginBottom: 10 }}>
              <GameTitle icon="ph:sword-fill" color="var(--gold)">{t('ch.hud_title', g.lang)}</GameTitle>
              <span className="tag">{tf('ch.card_tag', g.lang, { n: ch.count, mult: ch.mult })}</span>
            </div>
            <b style={{ display: 'block', fontSize: 16, color: 'var(--ink)' }}>{ch.nameKey ? t(ch.nameKey, g.lang) : ch.title}</b>
            <p style={{ marginTop: 4 }}>{ch.descKey ? t(ch.descKey, g.lang) : ch.desc}</p>
            <div style={{ marginTop: 12 }}>
              <GameButton onClick={onChallengePicker} disabled={chDone} secondary={chDone}>
                {chDone
                  ? <><Icon name="check" size={17} /> {t('ch.done_today', g.lang)}</>
                  : <><Icon name="ph:sword-fill" size={17} /> {t('ch.brief_start', g.lang)}</>}
              </GameButton>
            </div>
          </GamePanel>
        </motion.div>
      )}

      {/* Tugas harian */}
      <GamePanel>
        <div className="between" style={{ marginBottom: 10 }}>
          <GameTitle icon="ph:list-checks-fill" color="var(--op-sub)">{t('quests.title', g.lang)}</GameTitle>
          <small>{plan?.source === 'ai' ? t('quests.source_ai', g.lang) : t('quests.source_local', g.lang)}</small>
        </div>
        <QuestList g={g} setG={setG} plan={plan} />
      </GamePanel>

      {/* Naik tingkat */}
      {ai?.canAdvance && (
        <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
          <GamePanel glow>
            <div className="row" style={{ gap: 12, marginBottom: 12 }}>
              <Icon name="ph:arrow-circle-up-fill" size={32} color="var(--gold)" />
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--ink)' }}>{t('coach.ready', g.lang)}</div>
                <p style={{ marginTop: 3, fontSize: 13 }}>{tf('coach.ready_body', g.lang, { acc: Math.round(st.acc * 100), gold: Math.round(st.goldPct * 100) })}</p>
              </div>
            </div>
            <GameButton onClick={() => { sfx.levelup(); bigWin(); setG({ ...g, level: nextLevel(g.level), plan: null }) }}>
              {tf('coach.advance_btn', g.lang, { name: LEVELS[nextLevel(g.level)]?.name })}
            </GameButton>
          </GamePanel>
        </motion.div>
      )}

        </div>{/* /home-col-right */}
      </div>{/* /home-cols */}

    </div>
  )
}

/* --------------------------- Briefing tantangan --------------------------- */
function ChallengeBrief({ ch, g, onStart, onClose }) {
  const target = challengeTarget(ch.count)
  const items = Object.entries(g.items || {}).filter(([, n]) => n > 0)
  const rules = [
    { icon: 'ph:fire-fill', color: '#ff9f6b', text: t('ch.rule_combo', g.lang) },
    { icon: 'ph:timer-fill', color: 'var(--green)', text: t('ch.rule_speed', g.lang) },
    { icon: 'ph:lifebuoy-fill', color: 'var(--gold)',
      text: items.length
        ? tf('ch.brief_items', g.lang, { n: items.reduce((a, [, n]) => a + n, 0) })
        : t('ch.brief_noitems', g.lang) },
  ]
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div className="modal-panel ch-brief" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.9, y: 30, filter: 'blur(4px)' }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 0.92, y: 20, filter: 'blur(2px)' }}
        transition={{ type: 'spring', stiffness: 340, damping: 30, mass: .85 }}>

        <div className="ch-brief-banner">
          {/* Dramatic sword with glow */}
          <motion.div style={{ position: 'relative' }}
            initial={{ scale: 0, rotate: -60 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 14, delay: .05 }}>
            <motion.div style={{
              position: 'absolute', inset: -16, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(244,185,66,.25) 0%, transparent 70%)',
            }} animate={{ scale: [1, 1.3, 1], opacity: [.6, .2, .6] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }} />
            <motion.div animate={{ rotate: [-6, 6, -6] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}>
              <Icon name="ph:sword-fill" size={44} color="var(--gold)" />
            </motion.div>
          </motion.div>
          <motion.span className="ch-brief-tag"
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: .12 }}>{t('ch.brief_tag', g.lang)}</motion.span>
          <motion.h2 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: .16 }}>{ch.nameKey ? t(ch.nameKey, g.lang) : ch.title}</motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: .2 }}>{ch.descKey ? t(ch.descKey, g.lang) : ch.desc}</motion.p>
        </div>

        {/* Stats with count-up stagger */}
        <div className="ch-brief-stats">
          {[
            { val: ch.count, label: t('ch.brief_problems', g.lang), color: 'var(--violet)' },
            { val: target, label: t('ch.brief_target', g.lang), color: 'var(--gold)' },
            { val: `×${ch.mult}`, label: t('ch.brief_xp', g.lang), color: 'var(--green)' },
          ].map((s, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, scale: .8, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: .22 + i * .08, type: 'spring', stiffness: 350, damping: 22 }}>
              <motion.b style={{ color: s.color }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: .3 + i * .12 }}>{s.val}</motion.b>
              <span>{s.label}</span>
            </motion.div>
          ))}
        </div>

        {/* Rules stagger in */}
        <div className="ch-brief-rules">
          {rules.map((r, i) => (
            <motion.div key={i} className="ch-brief-rule"
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: .35 + i * .1, type: 'spring', stiffness: 300, damping: 24 }}>
              <motion.div
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.8, repeat: Infinity, delay: i * .6 }}>
                <Icon name={r.icon} size={18} color={r.color} />
              </motion.div>
              <span>{r.text}</span>
            </motion.div>
          ))}
        </div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: .55 }}>
          <GameButton onClick={onStart}>
            <Icon name="ph:sword-fill" size={18} /> {t('ch.brief_start', g.lang)}
          </GameButton>
        </motion.div>
        <motion.button className="btn ghost" onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .6 }}>
          {t('ch.brief_later', g.lang)}
        </motion.button>
      </motion.div>
    </motion.div>
  )
}

/* -------------------------------- Summary -------------------------------- */
function Summary({ s, g, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    if (g.reducedMotion) return
    const o = { v: 0 }
    gsap.to(o, { v: s.xp, duration: 1.2, ease: 'power2.out', onUpdate: () => { if (ref.current) ref.current.textContent = Math.round(o.v) } })
  }, []) // eslint-disable-line
  const acc = s.problems ? Math.round((s.correct / s.problems) * 100) : 0
  const icon = s.ranOut ? 'ph:moon-fill' : acc >= 80 ? 'ph:trophy-fill' : 'ph:sun-fill'
  const iconColor = s.ranOut ? 'var(--dim)' : acc >= 80 ? 'var(--gold)' : 'var(--op-add)'
  const isChallenge = s.kind === 'challenge' && s.target > 0
  const rank = isChallenge ? rankFor(s.score, s.target) : null
  const isHighRank = rank && (rank.key === 'S' || rank.key === 'A')
  const confettiColors = ['#ffd060','#ff9f6b','#3ec98a','#8d7bff','#ff7a6b','#5ec9ff','#ff85c0','#ffc86b']

  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      {isChallenge ? (
        <motion.div className="rank-reveal" style={{ position: 'relative' }}
          initial={{ scale: 0.15, opacity: 0, rotate: -15, filter: 'blur(6px)' }}
          animate={{ scale: 1, opacity: 1, rotate: 0, filter: 'blur(0px)' }}
          transition={{ type: 'spring', stiffness: 200, damping: 12, mass: .7 }}>
          {/* Confetti burst for S/A ranks */}
          {isHighRank && Array.from({ length: 24 }).map((_, i) => {
            const angle = (i / 24) * Math.PI * 2
            const dist = 80 + Math.random() * 60
            return (
              <motion.span key={i} style={{
                position: 'absolute', top: '50%', left: '50%',
                width: `${3 + Math.random() * 5}px`, height: `${3 + Math.random() * 5}px`,
                borderRadius: Math.random() > .5 ? '50%' : '1px',
                background: confettiColors[i % confettiColors.length],
                pointerEvents: 'none', zIndex: 0,
              }}
                initial={{ x: 0, y: 0, opacity: 1, scale: 0, rotate: 0 }}
                animate={{ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity: 0, scale: 1, rotate: Math.random() * 360 }}
                transition={{ duration: 1.2, delay: .2 + i * .04, ease: 'easeOut' }} />
            )
          })}
          <div className="rank-badge" style={{ '--rk': rank.color, position: 'relative', zIndex: 1 }}>
            <motion.span className="rank-ring" style={{ borderColor: rank.color }}
              animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }} />
            <motion.span className="rank-letter" style={{ color: rank.color }}
              initial={{ scale: 2 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 10, delay: .1 }}>
              {rank.key}
            </motion.span>
          </div>
          <motion.b className="rank-label" style={{ color: rank.color, position: 'relative', zIndex: 1 }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: .25 }}>{t(rank.labelKey, g.lang)}</motion.b>
          <motion.div className="rank-score" style={{ position: 'relative', zIndex: 1 }}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: .3 }}>
            <Icon name="ph:trophy-fill" size={16} color="var(--gold)" />
            <b>{s.score}</b><span>/ {s.target} {t('ch.points', g.lang)}</span>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div className="center" initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 10 }}>
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: .3 }}>
            <Icon name={icon} size={72} color={iconColor} />
          </motion.div>
        </motion.div>
      )}
      <motion.h1 className="center"
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35 }}>
        {isChallenge ? t('ch.summary_title', g.lang)
          : s.kind === 'war' ? t('sum.war_done', g.lang)
          : s.kind === 'defense' ? (s.ranOut ? t('sum.def_lost', g.lang) : t('sum.def_won', g.lang))
          : s.ranOut ? t('sum.normal_rest', g.lang) : acc >= 80 ? t('sum.normal_great', g.lang) : t('sum.normal_ok', g.lang)}
      </motion.h1>
      <motion.p className="center"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .38 }}>
        {isChallenge ? (s.score >= s.target
            ? t('ch.summary_won', g.lang)
            : t('ch.summary_lost', g.lang))
          : s.kind === 'war' ? tf('sum.war_body', g.lang, { n: s.stars })
          : s.kind === 'defense' ? (s.ranOut ? t('sum.def_lost_body', g.lang) : t('sum.def_won_body', g.lang))
          : s.ranOut ? t('sum.normal_rest_body', g.lang)
          : acc >= 80 ? t('sum.normal_great_body', g.lang) : t('sum.normal_ok_body', g.lang)}
      </motion.p>
      <motion.div className="grid g3"
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .4 }}>
        <motion.div className="stat"
          initial={{ scale: .8 }} animate={{ scale: 1 }}
          transition={{ delay: .44, type: 'spring', stiffness: 300 }}>
          <Icon name="ph:star-fill" size={20} color="var(--gold)" style={{ margin: '0 auto 4px' }} />
          <b ref={ref}>{g.reducedMotion ? s.xp : 0}</b><span>XP</span>
        </motion.div>
        <motion.div className="stat"
          initial={{ scale: .8 }} animate={{ scale: 1 }}
          transition={{ delay: .5, type: 'spring', stiffness: 300 }}>
          <Icon name="ph:check-circle-fill" size={20} color="var(--green)" style={{ margin: '0 auto 4px' }} />
          <b>{s.correct}/{s.problems}</b><span>{t('sum.correct', g.lang)}</span>
        </motion.div>
        <motion.div className="stat"
          initial={{ scale: .8 }} animate={{ scale: 1 }}
          transition={{ delay: .56, type: 'spring', stiffness: 300 }}>
          <b className="row center-x">
            {s.kind === 'war'
              ? <><Icon name="star" size={16} color="var(--gold)" />{s.stars}</>
              : <><Icon name="zap" size={16} color="var(--gold)" />{g.streak}</>}
          </b>
          <span>{s.kind === 'war' ? t('sum.war_stars', g.lang) : t('home.streak', g.lang)}</span>
        </motion.div>
      </motion.div>
      <motion.div className="card center"
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .6 }}>
        <p>{t('sum.time', g.lang)}: <b style={{ color: 'var(--ink)' }}>{Math.floor(s.seconds / 60)} {t('sum.minutes', g.lang)} {s.seconds % 60} {t('sum.seconds', g.lang)}</b></p>
      </motion.div>
      <div className="grow" />
      <motion.button className="btn" onClick={onClose}
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .65 }}>
        {t('sum.back', g.lang)}
      </motion.button>
    </div>
  )
}

/* ------------------------------- Settings -------------------------------- */
function Settings({ g, setG, onClose, onSignIn }) {
  return (
    <div className="screen">
      <div className="between"><h1>{t('settings.title', g.lang)}</h1><button className="pill icon-btn" onClick={onClose}><Icon name="x" size={18} /></button></div>

      <div className="card">
        <h3>{t('settings.account', g.lang)}</h3>
        {loggedIn() ? (
          <>
            <p style={{ marginTop: 6 }}>{t('settings.logged_in', g.lang)} <b style={{ color: 'var(--ink)' }}>{g.handle}</b>.</p>
            <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => { api.logout(); setG({ ...g, handle: '', clanId: null }) }}>
              <Icon name="log-out" size={17} /> {t('settings.logout', g.lang)}
            </button>
          </>
        ) : (
          <>
            <p style={{ marginTop: 6 }}>{t('settings.not_logged', g.lang)}</p>
            <button className="btn soft" style={{ marginTop: 12 }} onClick={onSignIn}><Icon name="user-plus" size={17} /> {t('settings.sign_in', g.lang)}</button>
          </>
        )}
      </div>

      <div className="card">
        <h3>{t('settings.goal', g.lang)}</h3>
        <div className="grid g3" style={{ marginTop: 10 }}>
          {GOALS.map((m) => <button key={m} className="chip" aria-pressed={g.goalMin === m} onClick={() => setG({ ...g, goalMin: m, plan: null })}>{m} mnt</button>)}
        </div>
      </div>

      <div className="card stack">
        <h3>{t('settings.comfort', g.lang)}</h3>
        <button className="chip" aria-pressed={g.dyslexic} onClick={() => setG({ ...g, dyslexic: !g.dyslexic })}>{t('settings.dyslexic', g.lang)}</button>
        <button className="chip" aria-pressed={g.reducedMotion} onClick={() => setG({ ...g, reducedMotion: !g.reducedMotion })}>{t('settings.reduce_motion', g.lang)}</button>
      </div>

      <div className="card stack">
        <h3>{t('settings.lang', g.lang)}</h3>
        <div className="row" style={{ gap: 8 }}>
          {LANGS.map((l) => (
            <button key={l.id} className="chip" aria-pressed={g.lang === l.id}
              onClick={() => setG({ ...g, lang: l.id })}>
              {l.flag} {t(`settings.lang_${l.id}`, g.lang)}
            </button>
          ))}
        </div>
      </div>

      <div className="card stack">
        <h3>{t('settings.level', g.lang)}</h3>
        <div className="grid g3">
          {Object.entries(LEVELS).map(([id, l]) => (
            <button key={id} className="chip" aria-pressed={g.level === id} onClick={() => setG({ ...g, level: id, plan: null })}>{l.name}</button>
          ))}
        </div>
        <small>{t('settings.level_note', g.lang)}</small>
      </div>

      <button className="btn ghost" onClick={() => { if (confirm(t('settings.wipe_confirm', g.lang))) { localStorage.clear(); location.reload() } }}>
        {t('settings.wipe', g.lang)}
      </button>
    </div>
  )
}

/* --------------------------------- Shell --------------------------------- */
export default function App() {
  const [g, setG] = useGame()
  const [tab, setTab] = useState('home')
  const [view, setView] = useState('main')
  const [session, setSession] = useState(null)
  const [summary, setSummary] = useState(null)
  const [focusDomain, setFocusDomain] = useState(null)
  const [picker, setPicker] = useState(null) // null | 'normal' | 'challenge'
  const [showSettings, setShowSettings] = useState(false)
  const [showBrief, setShowBrief] = useState(false)
  const [loadingSession, setLoadingSession] = useState(false)
  const [showFocusPicker, setShowFocusPicker] = useState(false)
  const [notif, setNotif] = useState(null) // {type, title, body, actions}

  useEffect(() => { document.body.classList.toggle('dyslexic', !!g.dyslexic) }, [g.dyslexic])
  useEffect(() => { document.body.dataset.skin = g.skin || '' }, [g.skin])
  // Auto-dismiss notif kecuali ada actions (konfirmasi menunggu klik user)
  useEffect(() => { if (notif && !notif.actions) { const t = setTimeout(() => setNotif(null), 4200); return () => clearTimeout(t) } }, [notif])
  // Lock body scroll when any modal/sheet is open
  useEffect(() => {
    const locked = showSettings || picker !== null || showFocusPicker || showBrief || view === 'session' || view === 'summary'
    document.documentElement.style.overflow = locked ? 'hidden' : ''
    document.body.style.overflow = locked ? 'hidden' : ''
    document.body.style.touchAction = locked ? 'none' : ''
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
  }, [showSettings, picker, showFocusPicker, showBrief, view])

  // Cek koneksi server AI sekali saat aplikasi terbuka
  useEffect(() => { checkAiOnline() }, [])

  useEffect(() => {
    if (!g.onboarded || g.plan?.day === dayKey()) return
    let alive = true
    dailyPlan(g).then((p) => alive && setG((s) => ({ ...s, plan: p })))
    return () => { alive = false }
  }, [g.onboarded, g.plan?.day, g.level]) // eslint-disable-line

  const start = async (kind, domain, node, focusMin) => {
    const ch = g.plan?.challenge
    const curEnergy = energyNow(g)
    const useEnergy = kind === 'normal' && curEnergy > 0
    const fresh = { ...g, hearts: heartsNow(g), heartsAt: Date.now(), combo: 0,
      energy: useEnergy ? curEnergy - 1 : curEnergy,
      energyDay: new Date().toISOString().slice(0, 10) }
    const opts = domain ? { domain } : {}
    const plans = {
      normal: () => {
        const count = g.plan?.coach?.sessionCount
        return { kind: 'normal', title: t('session.daily_training', g.lang), mult: useEnergy ? 1.5 : 1, problems: buildSession(fresh, g.goalMin, g.plan?.coach?.focus || [], count ? { ...opts, count } : opts) }
      },
      challenge: () => ({ kind: 'challenge', title: ch.nameKey ? t(ch.nameKey, g.lang) : ch.title, mult: ch.mult, problems: buildSession(fresh, 0, [], { count: ch.count, domain: ch.domainBias || ch.domain, variantBias: ch.variantBias, levelBias: ch.levelBias }) }),
      focus: () => ({ kind: 'focus', title: tf('home.focus_title', g.lang, { n: focusMin }), mult: ch.mult, focusMinutes: focusMin, problems: buildSession(fresh, 0, [], { count: Math.round(focusMin * 1.2), variantBias: 'word' }) }),
      war: () => ({ kind: 'war', title: t('session.clan_war', g.lang), mult: 1, problems: buildSession(fresh, 0, [], { count: 20, variantSeed: 7 }) }),
      defense: () => ({ kind: 'defense', title: t('session.kingdom_defense', g.lang), mult: 1, hp: 60 + Object.values(buildingLevels(g)).reduce((a, b) => a + b, 0) * 20, problems: buildSession(fresh, 0, [], { count: 15, variantSeed: 3 }) }),
      aipath: () => ({
        kind: 'aipath', title: node.title, mult: 1, node,
        problems: buildSession(fresh, 0, [], { count: NODE_PROBLEM_COUNT, skillIds: node.skillIds, variantSeed: node.skillIds.length }),
      }),
    }
    const plan = plans[kind]()
    setG(fresh)
    setPicker(null)
    setShowFocusPicker(false)

    // Challenge / Focus: coba AI dulu buat soal yang lebih variatif
    if (kind === 'challenge' || kind === 'focus') {
      setLoadingSession(true)
      const aiProblems = await challengeProblems(plan.problems.length, fresh.level, ch?.domain)
      if (aiProblems?.length) {
        // AI soal sudah termasuk teks variatif — langsung pakai
        setLoadingSession(false)
        setSession({ ...plan, problems: aiProblems })
        setView('session')
        return
      }
      // AI gagal, jatuh ke buildSession lokal + flavor
      const flavored = await flavorSession(plan.problems, fresh, 'challenge')
      setLoadingSession(false)
      setSession({ ...plan, problems: flavored })
      setView('session')
      return
    }

    setLoadingSession(true)
    const flavored = await flavorSession(plan.problems, fresh, plan.kind)
    setLoadingSession(false)
    setSession({ ...plan, problems: flavored })
    setView('session')
  }

  const done = (s) => {
    setG((cur) => {
      let next = finishSession(cur, s)
      if (s.kind === 'defense') Object.assign(next, { defenseDay: dayKey(), defenseWins: next.defenseWins + (s.ranOut ? 0 : 1) })
      if (s.kind === 'aipath' && session?.node) {
        const acc = s.problems ? s.correct / s.problems : 0
        next = clearPathNode(next, session.node.id, starsFor(acc))
      }
      push(next)
      // XP milestone rewards → modal
      if (next._milestones?.length) {
        const msgs = next._milestones.map((m) => `• ${m.label}`)
        setNotif({ type: 'milestone', title: t('misc.milestone', g.lang), body: msgs.join('\n') })
        burst({ particleCount: 60, spread: 80 })
      } else if (next._lastDrop) {
        const item = shopItem(next._lastDrop)
        setNotif({ type: 'reward', title: t('misc.free_item', g.lang), body: tf('misc.got_item', g.lang, { item: (item?.nameKey ? t(item.nameKey, g.lang) : item?.name) || next._lastDrop }), icon: item?.icon })
      }
      delete next._milestones; delete next._lastDrop
      return next
    })
    if (s.kind === 'war' && loggedIn()) api.warSession(s.stars).catch(() => {})
    // Mission sounds — challenge & focus
    if (s.kind === 'challenge' || s.kind === 'focus') {
      const won = s.target > 0 && s.score >= s.target
      if (won) sfx.missionSuccess()
      else sfx.missionFailed()
    }
    // Focus bonus: +XP for completed focus session
    if (s.focusCompleted && s.focusMinutes) {
      const bonusXp = Math.round(s.focusMinutes * 2)
      setG((cur) => {
        const next = { ...cur, xp: cur.xp + bonusXp, coins: cur.coins + Math.round(bonusXp / 4), sessions: cur.sessions + 1 }
        push(next)
        return next
      })
      sfx.levelup()
      bigWin()
      setNotif({ type: 'success', title: t('pomo.notif_title', g.lang), body: tf('pomo.notif_body', g.lang, { n: s.focusMinutes, xp: bonusXp }), icon: 'ph:trophy-fill' })
    }
    setSummary(s)
    setView('summary')
  }

  if (!g.onboarded)
    return <Onboarding onDone={({ level, goalMin }) => setG({ ...blank(), onboarded: true, level, goalMin })} />

  if (loadingSession)
    return (
      <div className="screen" style={{ justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }}>
          <Icon name="ph:robot-fill" size={48} color="var(--violet)" />
        </motion.div>
        <p className="center">{t('session.ai_thinking', g.lang)}</p>
      </div>
    )

  if (view === 'session') return <Session g={g} setG={setG} plan={session} onQuit={() => setView('main')} onDone={done} />
  if (view === 'summary') return <Summary s={summary} g={g} onClose={() => setView('main')} />
  if (view === 'auth') return <Auth g={g} setG={setG} onClose={() => setView('main')} />
  if (view === 'aipath') return <AIPath g={g} onStart={(node) => start('aipath', null, node)} onClose={() => setView('main')} />
  if (view === 'shop') return <Shop g={g} setG={setG} onClose={() => setView('main')} />
  if (view === 'learn') return <Learn g={g} />

  const screens = {
    home: <Home g={g} setG={setG} plan={g.plan}
      onStartPicker={() => setPicker('normal')}
      onChallengePicker={() => setShowBrief(true)}
      onOpenPath={() => setView('aipath')}
      onOpenShop={() => setView('shop')}
      onFocus={() => setShowFocusPicker(true)}
      onSettings={() => setShowSettings(true)} />,
    progress: <Progress g={g} />,
    kingdom: <Kingdom g={g} setG={setG} />,
    clan: <Clan g={g} setG={setG} onSignIn={() => setView('auth')} onStartWar={() => start('war')} />,
    arena: <Arena g={g} onSignIn={() => setView('auth')} onStartDefense={() => start('defense')} />,
    learn: <Learn g={g} />,
  }

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
          {screens[tab]}
        </motion.div>
      </AnimatePresence>

      {/* Focus picker sheet — muncul di atas nav */}
      <AnimatePresence>
        {picker === 'normal' && (
          <>
            <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setPicker(null)} />
            <FocusPicker
              visible
              selected={focusDomain}
              onSelect={setFocusDomain}
              onStart={() => start('normal', focusDomain)}
              lang={g.lang}
            />
          </>
        )}
      </AnimatePresence>

      {/* Focus duration picker — muncul saat user tap kartu Focus */}
      <AnimatePresence>
        {showFocusPicker && (
          <>
            <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowFocusPicker(false)} />
            <motion.div className="focus-sheet"
              initial={{ opacity: 0, y: 80, filter: 'blur(3px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 80, filter: 'blur(3px)' }}
              transition={{ type: 'spring', stiffness: 320, damping: 30, mass: .9 }}>
              <motion.h3 initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: .06 }}>{t('pomo.setup_title', g.lang)}</motion.h3>
              <motion.p style={{ fontSize: 13, color: 'var(--dim)', marginBottom: 14, textAlign: 'center' }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .1 }}>
                {t('home.focus_body', g.lang)}
              </motion.p>
              <div className="focus-grid">
                {FOCUS_DURATIONS.map((d, i) => (
                  <motion.button key={d.min} whileTap={{ scale: 0.93 }}
                    className="focus-card" style={{ '--fc': d.color }}
                    initial={{ opacity: 0, y: 24, scale: .9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: .12 + i * .08, type: 'spring', stiffness: 340, damping: 24 }}
                    onClick={() => { setShowFocusPicker(false); start('focus', null, null, d.min) }}>
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * .4 }}>
                      <Icon name={d.icon} size={36} color={d.color} />
                    </motion.div>
                    <b>{d.min}{t('pomo.min_abbr', g.lang)}</b>
                    <span>{tf('pomo.dur_label', g.lang, { n: d.min })}</span>
                  </motion.button>
                ))}
              </div>
              <motion.button className="btn ghost" style={{ marginTop: 12 }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: .4 }}
                onClick={() => setShowFocusPicker(false)}>
                {t('pomo.later', g.lang)}
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Briefing tantangan — muncul sebelum sesi dimulai */}
      <AnimatePresence>
        {showBrief && g.plan?.challenge && (
          <ChallengeBrief ch={g.plan.challenge} g={g}
            onClose={() => setShowBrief(false)}
            onStart={() => { setShowBrief(false); start('challenge') }} />
        )}
      </AnimatePresence>

      {/* Pengaturan — modal dengan overlay blur */}
      <AnimatePresence>
        {showSettings && (
          <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowSettings(false)}>
            <motion.div className="modal-panel" onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: .9, y: 24, filter: 'blur(4px)' }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: .92, y: 16, filter: 'blur(2px)' }}
              transition={{ type: 'spring', stiffness: 340, damping: 30, mass: .85 }}>
              <Settings g={g} setG={setG} onClose={() => setShowSettings(false)}
                onSignIn={() => { setShowSettings(false); setView('auth') }} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal notifikasi — gantiin toast */}
      <Modal
        visible={!!notif}
        type={notif?.type || 'info'}
        title={notif?.title}
        body={notif?.body}
        icon={notif?.icon}
        actions={notif?.actions}
        onClose={() => setNotif(null)}
      />

      <nav className="nav">
        {[
          ['home', 'ph:house-fill', 'ph:house', 'nav.home'],
          ['progress', 'ph:chart-line-up-fill', 'ph:chart-line-up', 'nav.progress'],
          ['kingdom', 'ph:castle-turret-fill', 'ph:castle-turret', 'nav.kingdom'],
          ['learn', 'ph:book-open-text-fill', 'ph:book-open-text', 'nav.learn'],
          ['clan', 'ph:users-three-fill', 'ph:users-three', 'nav.clan'],
          ['arena', 'ph:sword-fill', 'ph:sword', 'nav.arena'],
        ].map(([id, iconActive, iconIdle, labelKey]) => (
          <button key={id} aria-current={tab === id} onClick={() => setTab(id)}>
            <Icon name={tab === id ? iconActive : iconIdle} size={20} />
            <span>{t(labelKey, g.lang)}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
