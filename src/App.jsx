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
import Pomodoro from './Pomodoro.jsx'
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
      initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}>
        <h3 style={{ marginBottom: 12 }}>{label || t('focus.title', lang)}</h3>
        <div className="focus-grid">
          {FOCUS_OPTIONS.map((opt) => (
            <motion.button key={String(opt.id)} whileTap={{ scale: 0.93 }}
              className={'focus-card' + (selected === opt.id ? ' active' : '')}
              style={{ '--fc': opt.color }}
              onClick={() => onSelect(opt.id)}>
              <Icon name={opt.icon} size={36} />
              <span>{t(opt.labelKey, lang)}</span>
            </motion.button>
          ))}
        </div>
        <motion.button className="btn" style={{ marginTop: 16 }} whileTap={{ scale: 0.97 }} onClick={onStart}>
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
function Home({ g, setG, plan, onStartPicker, onChallengePicker, onOpenPath, onOpenShop, onPomodoro, onSettings }) {
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

        {/* 7 hari terakhir — streak kelihatan, bukan cuma angka */}
        <div className="week-strip">
          {week.map((d, k) => (
            <div key={d.key} className={'week-day' + (d.goalMet ? ' met' : d.problems ? ' partial' : '')}>
              <span className="week-dot">{d.goalMet && <Icon name="check" size={11} />}</span>
              <small>{DAY_LETTER[(new Date(d.key).getDay() + 7) % 7]}</small>
            </div>
          ))}
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
        <span className={'start-note' + (energyNow(g) > 0 ? ' hot' : '')}>
          <Icon name="ph:flask-fill" size={13} color={energyNow(g) > 0 ? 'var(--green)' : 'var(--dim)'} />
          {energyNow(g) > 0
            ? <>{tf('home.energy_has', g.lang, { n: energyNow(g) })}</>
            : <>{t('home.energy_out', g.lang)}</>}
        </span>
      </div>

      {/* Aksi cepat — 3 kartu sejajar */}
      <div className="quick-grid">
        <motion.button className="quick-card quick-card--path" onClick={onOpenPath} whileTap={{ scale: 0.97 }}>
          <span className="quick-icon" style={{ background: 'rgba(141,123,255,.12)', borderColor: 'rgba(141,123,255,.25)' }}>
            <Icon name="ph:robot-fill" size={22} color="var(--violet)" />
          </span>
          <b>{t('path.card_title', g.lang)}</b>
          <span className="quick-sub">{t('path.card_sub', g.lang)}</span>
          <span className="quick-foot" style={{ color: 'var(--violet)' }}>
            {pathProgress(g).done}/{pathProgress(g).total}
          </span>
        </motion.button>

        <motion.button className="quick-card quick-card--pomo" onClick={onPomodoro} whileTap={{ scale: 0.97 }}>
          <span className="quick-icon" style={{ background: 'rgba(255,159,107,.12)', borderColor: 'rgba(255,159,107,.25)' }}>
            <Icon name="ph:brain-fill" size={22} color="#ff9f6b" />
          </span>
          <b>{t('home.action_focus', g.lang)}</b>
          <span className="quick-sub">{t('home.action_focus_sub', g.lang)}</span>
          <span className="quick-foot" style={{ color: '#ff9f6b' }}>
            <Icon name="ph:timer-fill" size={11} /> +XP
          </span>
        </motion.button>

        <motion.button className="quick-card quick-card--shop" onClick={onOpenShop} whileTap={{ scale: 0.97 }}>
          <span className="quick-icon" style={{ background: 'rgba(255,200,107,.12)', borderColor: 'rgba(255,200,107,.25)' }}>
            <Icon name="ph:storefront-fill" size={22} color="#ffc86b" />
          </span>
          <b>{t('shop.card_title', g.lang)}</b>
          <span className="quick-sub">{t('shop.card_sub', g.lang)}</span>
          <span className="quick-foot" style={{ color: '#ffc86b' }}>
            <Icon name="ph:coin-fill" size={11} /> {g.coins}
          </span>
        </motion.button>
      </div>

      {/* Pelatih AI — maskot yang lagi ngomong, bukan kartu data */}
      {ai && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <GamePanel className="gp-coach gp-coach--mascot">
            <div className="coach-row">
              <AiMascot happy={st.acc >= 0.85} />
              <motion.div className="coach-bubble"
                initial={{ opacity: 0, scale: 0.85, x: -6 }} animate={{ opacity: 1, scale: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 340, damping: 24, delay: 0.1 }}>
                <span className="coach-bubble-tail" />
                <span className="coach-bubble-name">
                  {plan.source === 'ai' ? t('coach.title_ai', g.lang) : t('coach.title_local', g.lang)}
                  <span className="ai-dot" data-online={aiOnline() ? '1' : '0'} title={aiOnline() ? 'Server AI tersambung' : 'Server AI tidak terjangkau — pakai generator lokal'} />
                </span>
                <p>{oneLine(ai.message)}</p>
              </motion.div>
            </div>

            <motion.div className="coach-chips" initial="hidden" animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.4 } } }}>
              <motion.span className="coach-chip coach-chip--acc" variants={popVariant}
                style={{ '--cc': st.acc >= 0.85 ? 'var(--green)' : 'var(--gold)' }}>
                <Icon name="ph:target-fill" size={12} /> {Math.round(st.acc * 100)}%
              </motion.span>
              {(ai.focus || []).slice(0, 4).map((id) => {
                const s = skillById[id]
                if (!s) return null
                const d = DOMAINS[s.domain]
                return (
                  <motion.span key={id} className="coach-chip" variants={popVariant} title={s.name}>
                    <Icon name={d.icon} size={12} color="var(--gold)" />
                  </motion.span>
                )
              })}
              <motion.span className="coach-chip" variants={popVariant}>
                <Icon name="ph:list-numbers-fill" size={12} /> {ai.sessionCount || 12} soal
              </motion.span>
            </motion.div>
          </GamePanel>
        </motion.div>
      )}

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

      {/* Kerajaan mini */}
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

    </div>
  )
}

/* --------------------------- Briefing tantangan --------------------------- */
// Layar taruhan sebelum masuk: bikin user tahu aturannya dan sadar ini beda
// dari latihan biasa — combo yang nentuin, bukan cuma benar/salah.
function ChallengeBrief({ ch, g, onStart, onClose }) {
  const target = challengeTarget(ch.count)
  const items = Object.entries(g.items || {}).filter(([, n]) => n > 0)
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}>
      <motion.div className="modal-panel ch-brief" onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.92, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 24 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}>

        <div className="ch-brief-banner">
          <motion.div animate={{ rotate: [-8, 8, -8] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}>
            <Icon name="ph:sword-fill" size={40} color="var(--gold)" />
          </motion.div>
          <span className="ch-brief-tag">{t('ch.brief_tag', g.lang)}</span>
          <h2>{ch.nameKey ? t(ch.nameKey, g.lang) : ch.title}</h2>
          <p>{ch.descKey ? t(ch.descKey, g.lang) : ch.desc}</p>
        </div>

        <div className="ch-brief-stats">
          <div><b>{ch.count}</b><span>{t('ch.brief_problems', g.lang)}</span></div>
          <div><b style={{ color: 'var(--gold)' }}>{target}</b><span>{t('ch.brief_target', g.lang)}</span></div>
          <div><b style={{ color: 'var(--violet)' }}>×{ch.mult}</b><span>{t('ch.brief_xp', g.lang)}</span></div>
        </div>

        <div className="ch-brief-rules">
          <div className="ch-brief-rule">
            <Icon name="ph:fire-fill" size={16} color="#ff9f6b" />
            <span>{t('ch.rule_combo', g.lang)}</span>
          </div>
          <div className="ch-brief-rule">
            <Icon name="ph:timer-fill" size={16} color="var(--green)" />
            <span>{t('ch.rule_speed', g.lang)}</span>
          </div>
          <div className="ch-brief-rule">
            <Icon name="ph:lifebuoy-fill" size={16} color="var(--gold)" />
            <span>{items.length
              ? <>{tf('ch.brief_items', g.lang, { n: items.reduce((a, [, n]) => a + n, 0) })}</>
              : <>{t('ch.brief_noitems', g.lang)}</>}</span>
          </div>
        </div>

        <GameButton onClick={onStart}>
          <Icon name="ph:sword-fill" size={18} /> {t('ch.brief_start', g.lang)}
        </GameButton>
        <button className="btn ghost" onClick={onClose}>{t('ch.brief_later', g.lang)}</button>
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

  return (
    <div className="screen" style={{ justifyContent: 'center' }}>
      {isChallenge ? (
        <motion.div className="rank-reveal"
          initial={{ scale: 0.2, opacity: 0, rotate: -12 }} animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 220, damping: 14 }}>
          <div className="rank-badge" style={{ '--rk': rank.color }}>
            <motion.span className="rank-ring" style={{ borderColor: rank.color }}
              animate={{ scale: [1, 1.12, 1], opacity: [0.6, 0.15, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }} />
            <span className="rank-letter" style={{ color: rank.color }}>{rank.key}</span>
          </div>
          <b className="rank-label" style={{ color: rank.color }}>{t(rank.labelKey, g.lang)}</b>
          <div className="rank-score">
            <Icon name="ph:trophy-fill" size={16} color="var(--gold)" />
            <b>{s.score}</b><span>/ {s.target} {t('ch.points', g.lang)}</span>
          </div>
        </motion.div>
      ) : (
        <motion.div className="center" initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', damping: 10 }}>
          <Icon name={icon} size={72} color={iconColor} />
        </motion.div>
      )}
      <h1 className="center">
        {isChallenge ? t('ch.summary_title', g.lang)
          : s.kind === 'war' ? t('sum.war_done', g.lang)
          : s.kind === 'defense' ? (s.ranOut ? t('sum.def_lost', g.lang) : t('sum.def_won', g.lang))
          : s.ranOut ? t('sum.normal_rest', g.lang) : acc >= 80 ? t('sum.normal_great', g.lang) : t('sum.normal_ok', g.lang)}
      </h1>
      <p className="center">
        {isChallenge ? (s.score >= s.target
            ? t('ch.summary_won', g.lang)
            : t('ch.summary_lost', g.lang))
          : s.kind === 'war' ? tf('sum.war_body', g.lang, { n: s.stars })
          : s.kind === 'defense' ? (s.ranOut ? t('sum.def_lost_body', g.lang) : t('sum.def_won_body', g.lang))
          : s.ranOut ? t('sum.normal_rest_body', g.lang)
          : acc >= 80 ? t('sum.normal_great_body', g.lang) : t('sum.normal_ok_body', g.lang)}
      </p>
      <div className="grid g3">
        <div className="stat">
          <Icon name="ph:star-fill" size={20} color="var(--gold)" style={{ margin: '0 auto 4px' }} />
          <b ref={ref}>{g.reducedMotion ? s.xp : 0}</b><span>XP</span>
        </div>
        <div className="stat">
          <Icon name="ph:check-circle-fill" size={20} color="var(--green)" style={{ margin: '0 auto 4px' }} />
          <b>{s.correct}/{s.problems}</b><span>{t('sum.correct', g.lang)}</span>
        </div>
        <div className="stat">
          <b className="row center-x">
            {s.kind === 'war'
              ? <><Icon name="star" size={16} color="var(--gold)" />{s.stars}</>
              : <><Icon name="zap" size={16} color="var(--gold)" />{g.streak}</>}
          </b>
          <span>{s.kind === 'war' ? t('sum.war_stars', g.lang) : t('home.streak', g.lang)}</span>
        </div>
      </div>
      <div className="card center">
        <p>{t('sum.time', g.lang)}: <b style={{ color: 'var(--ink)' }}>{Math.floor(s.seconds / 60)} {t('sum.minutes', g.lang)} {s.seconds % 60} {t('sum.seconds', g.lang)}</b></p>
      </div>
      <div className="grow" />
      <button className="btn" onClick={onClose}>{t('sum.back', g.lang)}</button>
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
  const [showPomodoro, setShowPomodoro] = useState(false)
  const [notif, setNotif] = useState(null) // {type, title, body, actions}

  useEffect(() => { document.body.classList.toggle('dyslexic', !!g.dyslexic) }, [g.dyslexic])
  useEffect(() => { document.body.dataset.skin = g.skin || '' }, [g.skin])
  // Auto-dismiss notif kecuali ada actions (konfirmasi menunggu klik user)
  useEffect(() => { if (notif && !notif.actions) { const t = setTimeout(() => setNotif(null), 4200); return () => clearTimeout(t) } }, [notif])

  // Cek koneksi server AI sekali saat aplikasi terbuka
  useEffect(() => { checkAiOnline() }, [])

  useEffect(() => {
    if (!g.onboarded || g.plan?.day === dayKey()) return
    let alive = true
    dailyPlan(g).then((p) => alive && setG((s) => ({ ...s, plan: p })))
    return () => { alive = false }
  }, [g.onboarded, g.plan?.day, g.level]) // eslint-disable-line

  const start = async (kind, domain, node) => {
    const ch = g.plan?.challenge
    const curEnergy = energyNow(g)
    // Energi bukan gerbang, tapi katalis: kalau punya energi, sesi ini dapat bonus 1.5× XP.
    // Tanpa energi tetap bisa main — cuma XP normal.
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
      challenge: () => ({ kind: 'challenge', title: ch.nameKey ? t(ch.nameKey, g.lang) : ch.title, mult: ch.mult, problems: buildSession(fresh, 0, [], { count: ch.count, domain: ch.domain, variantBias: ch.variantBias }) }),
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

    // Challenge: coba AI dulu buat soal yang lebih variatif
    if (kind === 'challenge') {
      setLoadingSession(true)
      const aiProblems = await challengeProblems(ch.count, fresh.level, ch.domain)
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
    // Mission sounds — challenge only
    if (s.kind === 'challenge') {
      const won = s.target > 0 && s.score >= s.target
      if (won) sfx.missionSuccess()
      else sfx.missionFailed()
    }
    setSummary(s)
    setView('summary')
  }

  const handlePomodoroDone = (result) => {
    if (result.quit) {
      // User quit early — deduct XP
      setG((cur) => {
        const penalty = result.penalty || 50
        const next = { ...cur, xp: Math.max(0, cur.xp - penalty) }
        // Track pomodoro attempt
        const d = dayKey()
        const day = { ...(cur.days[d] || { sec: 0, problems: 0, correct: 0, xp: 0, fast: 0, maxCombo: 0, dom: {}, form: {}, goalMet: false }) }
        next.days = { ...cur.days, [d]: { ...day, sec: day.sec + Math.round(result.seconds || 0) } }
        push(next)
        return next
      })
      sfx.wrong()
    } else {
      // Completed pomodoro — give bonus XP
      const bonusXp = Math.round((result.durationMin || 15) * 2)
      setG((cur) => {
        let next = { ...cur, xp: cur.xp + bonusXp, coins: cur.coins + Math.round(bonusXp / 4), sessions: cur.sessions + 1 }
        const d = dayKey()
        const day = { ...(cur.days[d] || { sec: 0, problems: 0, correct: 0, xp: 0, fast: 0, maxCombo: 0, dom: {}, form: {}, goalMet: false }) }
        next.days = { ...cur.days, [d]: { ...day, sec: day.sec + Math.round(result.seconds || 0), xp: day.xp + bonusXp } }
        push(next)
        return next
      })
      sfx.levelup()
      bigWin()
      setNotif({ type: 'success', title: t('pomo.notif_title', g.lang), body: tf('pomo.notif_body', g.lang, { n: result.durationMin, xp: bonusXp }), icon: 'ph:trophy-fill' })
    }
    setView('main')
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
  if (view === 'pomodoro') return <Pomodoro g={g} onDone={handlePomodoroDone} onClose={() => setView('main')} />
  if (view === 'learn') return <Learn g={g} />

  const screens = {
    home: <Home g={g} setG={setG} plan={g.plan}
      onStartPicker={() => setPicker('normal')}
      onChallengePicker={() => setShowBrief(true)}
      onOpenPath={() => setView('aipath')}
      onOpenShop={() => setView('shop')}
      onPomodoro={() => setView('pomodoro')}
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
              initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: 'spring', stiffness: 340, damping: 30 }}>
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
