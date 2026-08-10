import React, { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import gsap from 'gsap'
import Icon from './Icon.jsx'
import { fmt, parseNum, warStars, VARIANT_NAME, comboMult, scoreFor, challengeTarget } from './engine.js'
import { recordAnswer, loseHeart, useItem, energyNow, shopItem } from './store.js'
import { explainProblem } from './ai.js'
import { sfx } from './sound.js'
import { burst, bigWin } from './celebrate.js'
import { t, tf } from './i18n.js'

const TIME_LIMIT = { easy: 30, mid: 20, adv: 12 }
const OVERTIME_SEC = 15
const QUIT_XP_PENALTY = 15

// ---- Cincin hitung-mundur ------------------------------------------------
function TimerRing({ timeLeft, maxTime, overtime }) {
  const R = 22
  const C = 2 * Math.PI * R
  const pct = maxTime > 0 ? timeLeft / maxTime : 0
  const color = overtime ? 'var(--red)' : pct > 0.5 ? 'var(--green)' : pct > 0.25 ? 'var(--gold)' : 'var(--red)'
  return (
    <svg width={54} height={54} viewBox="0 0 54 54" style={{ flexShrink: 0 }}>
      <circle cx={27} cy={27} r={R} fill="none" stroke="var(--line)" strokeWidth={4} />
      <circle cx={27} cy={27} r={R} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={`${C * pct} ${C}`} strokeLinecap="round"
        transform="rotate(-90 27 27)"
        style={{ transition: 'stroke-dasharray 0.8s linear, stroke 0.3s' }} />
      <text x={27} y={32} textAnchor="middle" fill={color} fontSize={13} fontWeight="800"
        fontFamily="inherit">{timeLeft}</text>
    </svg>
  )
}

// ---- Titik-titik CRA -------------------------------------------------------
const Dots = ({ v }) => {
  if (v.type === 'groups')
    return (
      <div className="dots">
        {Array.from({ length: v.g }).map((_, i) => (
          <motion.div key={i} className="group" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: i * 0.08 }}>
            {Array.from({ length: v.p }).map((__, j) => <span key={j} className="dot" />)}
          </motion.div>
        ))}
      </div>
    )
  const total = v.a + Math.max(0, v.b)
  return (
    <div className="dots">
      <div className="group" style={{ maxWidth: 200 }}>
        {Array.from({ length: total }).map((_, i) => (
          <motion.span key={i} className={'dot' + (v.b < 0 && i >= v.a + v.b ? ' gone' : '')}
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.05 }} />
        ))}
      </div>
    </div>
  )
}

export default function Session({ g, setG, plan, onDone, onQuit }) {
  const list = plan.problems
  const [i, setI] = useState(0)
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState('ask')
  const [hinted, setHinted] = useState(false)
  const [explained, setExplained] = useState(false)
  const [hiddenChoices, setHiddenChoices] = useState([])
  const [aiExplain, setAiExplain] = useState(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [wrongTips, setWrongTips] = useState(null)     // tips AI otomatis saat salah
  const [tipsLoading, setTipsLoading] = useState(false)
  const [tipsDismissed, setTipsDismissed] = useState(false)
  const [hp, setHp] = useState(plan.hp || 0)
  const [tally, setTally] = useState({ correct: 0, problems: 0, xp: 0, started: Date.now() })
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT[g.level] || 30)
  const [isOvertime, setIsOvertime] = useState(false)
  const [timeoutFlash, setTimeoutFlash] = useState(false)
  const [frozenUntil, setFrozenUntil] = useState(0)
  const [showQuit, setShowQuit] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [comeback, setComeback] = useState(false)    // bonus XP di jawaban berikutnya setelah salah
  const [scorePop, setScorePop] = useState(null)      // {text, mult, color}
  const [score, setScore] = useState(0)               // skor mode tantangan
  const cardRef = useRef(null)
  const screenRef = useRef(null)
  const startRef = useRef(Date.now())
  const gained = useRef(0)
  const timerRef = useRef(null)
  const frozenRef = useRef(0)
  const handledZeroRef = useRef(false)
  const tallyRef = useRef(tally)
  tallyRef.current = tally

  const useTimer = plan.kind === 'normal' || plan.kind === 'challenge' || plan.kind === 'ultimate'
  const useHearts = useTimer
  const isChallenge = plan.kind === 'challenge'
  const isFocus = plan.kind === 'focus'
  const isUltimate = plan.kind === 'ultimate'
  // Compute current tier for Ultimate Mode
  const tiers = plan.tiers || {}
  const currentTier = isUltimate
    ? i < tiers.easy ? 'easy' : i < tiers.easy + (tiers.mid || 0) ? 'mid' : 'adv'
    : null
  const hearts = g.hearts
  const combo = g.combo || 0
  const p = list[i]
  const target = challengeTarget(list.length)

  // ── Focus timer (Pomodoro) ──────────────────────────────────────────
  const focusTotal = (plan.focusMinutes || 0) * 60
  const [focusLeft, setFocusLeft] = useState(focusTotal)
  const focusRef = useRef(null)

  useEffect(() => {
    if (!isFocus || focusTotal <= 0) return
    focusRef.current = setInterval(() => {
      setFocusLeft((t) => Math.max(0, t - 1))
    }, 1000)
    return () => clearInterval(focusRef.current)
  }, [isFocus, focusTotal])

  // Auto-end when focus timer hits 0
  useEffect(() => {
    if (!isFocus || focusLeft > 0 || focusTotal <= 0) return
    clearInterval(focusRef.current)
    clearInterval(timerRef.current)
    const t = tallyRef.current
    const seconds = Math.round((Date.now() - t.started) / 1000)
    onDone({
      kind: plan.kind, seconds, problems: t.problems, correct: t.correct, xp: t.xp,
      ranOut: false, hpLeft: 99, score, target,
      focusCompleted: true, focusMinutes: plan.focusMinutes,
    })
  }, [focusLeft, isFocus, focusTotal]) // eslint-disable-line

  const focusPct = focusTotal > 0 ? focusLeft / focusTotal : 0
  const focusColor = focusLeft <= 60 ? 'var(--red)' : focusLeft <= focusTotal * 0.25 ? 'var(--gold)' : 'var(--green)'

  useEffect(() => { startRef.current = Date.now() }, [i])

  // Lifeline sekali pakai per soal — dibersihkan lagi begitu pindah soal
  useEffect(() => { setHiddenChoices([]); setAiExplain(null); setAiLoading(false); setWrongTips(null); setTipsLoading(false); setTipsDismissed(false); setScorePop(null) }, [i])

  // Auto-fetch tips AI saat user salah jawab — non-blocking, user tetap bisa lanjut
  useEffect(() => {
    if (phase !== 'wrong' || wrongTips || tipsLoading) return
    setTipsLoading(true)
    explainProblem(p).then((result) => {
      setTipsLoading(false)
      if (result?.tips) setWrongTips(result.tips)
    }).catch(() => setTipsLoading(false))
  }, [phase, i]) // eslint-disable-line

  // Reset timer when question changes
  useEffect(() => {
    clearInterval(timerRef.current)
    setTimeLeft(TIME_LIMIT[g.level] || 30)
    setIsOvertime(false)
    setTimeoutFlash(false)
    setFrozenUntil(0)
    frozenRef.current = 0
    handledZeroRef.current = false
  }, [i, g.level])

  // Countdown tick — only decrements, no side effects inside updater
  useEffect(() => {
    if (!useTimer || phase !== 'ask') {
      clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(() => {
      if (Date.now() < frozenRef.current) return
      setTimeLeft((t) => Math.max(0, t - 1))
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [phase, i, isOvertime, useTimer])

  // Handle timeout: runs when timeLeft reaches 0
  useEffect(() => {
    if (!useTimer || phase !== 'ask' || timeLeft > 0 || handledZeroRef.current) return
    handledZeroRef.current = true
    clearInterval(timerRef.current)

    if (!isOvertime) {
      // Waktu normal habis → kurangi nyawa, tampilkan flash, mulai waktu tambahan
      sfx.heartLoss()
      setG((prev) => loseHeart(prev))
      setIsOvertime(true)
      setTimeoutFlash(true)
      setTimeout(() => {
        setTimeoutFlash(false)
        setTimeLeft(OVERTIME_SEC)
        handledZeroRef.current = false
      }, 900)
    } else {
      // Waktu tambahan habis → lewati soal ini (tanpa pengurangan nyawa lagi)
      const t = tallyRef.current
      const seconds = Math.round((Date.now() - t.started) / 1000)
      const isLast = i + 1 >= list.length
      // Check dead using hearts from g (already updated by setG above)
      if (isLast || hearts <= 0) {
        onDone({
          kind: plan.kind, seconds, problems: t.problems, correct: t.correct, xp: t.xp,
          ranOut: hearts <= 0, hpLeft: hp, score, target,
          stars: plan.kind === 'war' ? warStars({ correct: t.correct, problems: t.problems, seconds }) : 0,
        })
      } else {
        setI((prev) => prev + 1)
        setInput('')
        setPhase('ask')
        setHinted(false)
        setExplained(false)
      }
    }
  }, [timeLeft, phase, useTimer]) // eslint-disable-line

  if (!p) return null

  const dead = useHearts ? hearts <= 0 : plan.kind === 'defense' ? hp <= 0 : false
  const maxTime = isOvertime ? OVERTIME_SEC : (TIME_LIMIT[g.level] || 30)

  const submit = (raw) => {
    if (phase !== 'ask') return
    clearInterval(timerRef.current)
    const ms = Date.now() - startRef.current
    const given = typeof p.answer === 'string' ? raw : parseNum(raw)
    const correct = given === p.answer
    // Comeback: setelah salah, jawaban benar berikutnya bonus +5 XP
    const comebackBonus = correct && comeback ? 5 : 0
    const before = g.xp
    let next = recordAnswer(g, p, { correct, hinted, explained, ms, mult: plan.mult || 1 })
    if (comebackBonus) { next = { ...next, xp: next.xp + comebackBonus, coins: next.coins + 1 } }
    gained.current = next.xp - before
    setG(next)
    const newCorrect = tally.correct + (correct ? 1 : 0)
    const newTally = { ...tally, correct: newCorrect, problems: tally.problems + 1, xp: tally.xp + gained.current }
    setTally(newTally)
    tallyRef.current = newTally
    setPhase(correct ? 'right' : 'wrong')
    setComeback(!correct)

    // Skor tantangan: combo dihitung dari nilai SEBELUM jawaban ini masuk,
    // makanya pakai (g.combo + 1) — `next.combo` belum kebaca di render ini.
    if (isChallenge) {
      if (correct) {
        const cm = (g.combo || 0) + 1
        const pts = scoreFor({ combo: cm, ms, limitMs: (TIME_LIMIT[g.level] || 30) * 1000 })
        setScore((s) => s + pts)
        setScorePop({ text: `+${pts}`, mult: comboMult(cm), color: 'var(--gold)' })
      } else if (combo >= 2) {
        setScorePop({ text: t('ch.combo_broken', g.lang), color: 'var(--red)' })
      }
    }

    if (!correct) {
      sfx.wrong()
      if (plan.kind === 'defense') setHp((h) => Math.max(0, h - 12))
      gsap.fromTo(cardRef.current, { x: -10 }, { x: 0, duration: 0.5, ease: 'elastic.out(1,0.3)' })
    } else {
      sfx.correct()
      if (newCorrect > 0 && newCorrect % 5 === 0) { sfx.levelup(); burst({ particleCount: 60, spread: 70 }) }
      else if (comebackBonus) burst({ particleCount: 25, spread: 50 })
      gsap.fromTo(cardRef.current, { scale: 0.97 }, { scale: 1, duration: 0.45, ease: 'back.out(2)' })
    }
  }

  const finishSession = () => {
    clearInterval(timerRef.current)
    const seconds = Math.round((Date.now() - tally.started) / 1000)
    const acc = tally.problems ? tally.correct / tally.problems : 0
    if (acc >= 0.8 && tally.problems >= 5) { sfx.levelup(); bigWin() }
    onDone({
      kind: plan.kind, seconds, problems: tally.problems, correct: tally.correct, xp: tally.xp,
      ranOut: dead, hpLeft: hp, score, target,
      stars: plan.kind === 'war' ? warStars({ correct: tally.correct, problems: tally.problems, seconds }) : 0,
    })
  }

  const next = () => {
    if (dead || i + 1 >= list.length) return finishSession()
    setI(i + 1); setInput(''); setPhase('ask'); setHinted(false); setExplained(false)
  }

  const confirmQuit = () => {
    clearInterval(timerRef.current)
    setG((prev) => ({ ...prev, xp: Math.max(0, prev.xp - QUIT_XP_PENALTY) }))
    setShowQuit(false)
    onQuit()
  }

  const tapKey = (k) => {
    sfx.tap()
    if (k === 'del') return setInput((s) => s.slice(0, -1))
    setInput((s) => (s.length < 7 ? s + k : s))
  }

  const fiftyLeft = g.items?.fifty || 0
  const askAiLeft = g.items?.askai || 0

  const use5050 = () => {
    if (phase !== 'ask' || fiftyLeft <= 0 || !p.choices || p.choices.length < 3) return
    sfx.tap()
    setG(useItem(g, 'fifty'))
    const wrong = p.choices.filter((c) => String(c) !== String(p.answer)).sort(() => Math.random() - 0.5)
    // Selalu sisakan jawaban benar + 1 pengecoh. Kalau semua pengecoh dibuang,
    // yang tersisa cuma jawabannya — itu bukan 50:50, itu bocoran.
    setHiddenChoices(wrong.slice(0, Math.max(0, wrong.length - 1)).map(String))
  }

  const useAskAi = async () => {
    if (phase !== 'ask' || askAiLeft <= 0 || aiLoading || aiExplain) return
    sfx.tap()
    setG(useItem(g, 'askai'))
    setAiLoading(true)
    const result = await explainProblem(p)
    setAiLoading(false)
    if (result?.tips) {
      setAiExplain(result.tips.map((t) => `${t.title}: ${t.steps.join(' ')}`).join(' | '))
    } else {
      setAiExplain(p.why.join(' '))
    }
  }

  const useFreeze = () => {
    if (phase !== 'ask') return
    const owned = g.items?.freeze || 0
    if (owned <= 0) return
    sfx.tap()
    setG(useItem(g, 'freeze'))
    const until = Date.now() + 10000
    frozenRef.current = until
    setFrozenUntil(until)
  }

  const useHeartPotion = () => {
    if (phase !== 'ask') return
    const owned = g.items?.heartpotion || 0
    if (owned <= 0 || g.hearts >= 5) return
    sfx.tap()
    setG((prev) => {
      const after = useItem(prev, 'heartpotion')
      return { ...after, hearts: Math.min(5, after.hearts + 1) }
    })
  }

  const useShieldPotion = () => {
    if (phase !== 'ask' || g.shieldActive) return
    const owned = g.items?.shieldpotion || 0
    if (owned <= 0) return
    sfx.tap()
    setG((prev) => ({ ...useItem(prev, 'shieldpotion'), shieldActive: true }))
  }

  const useDoubleXp = () => {
    if (phase !== 'ask') return
    const owned = g.items?.doublexp || 0
    if (owned <= 0) return
    sfx.tap()
    setG((prev) => ({ ...useItem(prev, 'doublexp'), doubleXp: prev.doubleXp + 3 }))
  }

  const useReroll = () => {
    if (phase !== 'ask' || i >= list.length - 1) return
    const owned = g.items?.reroll || 0
    if (owned <= 0) return
    sfx.tap()
    setG((prev) => useItem(prev, 'reroll'))
    next() // lewati soal ini — tanpa penalti
  }

  const useEnergyDrink = () => {
    if (phase !== 'ask') return
    const owned = g.items?.energydrink || 0
    if (owned <= 0) return
    sfx.tap()
    setG((prev) => {
      const after = useItem(prev, 'energydrink')
      return { ...after, energy: Math.min(5, energyNow(prev) + 2), energyDay: new Date().toISOString().slice(0, 10) }
    })
  }

  const useHintScroll = () => {
    if (phase !== 'ask' || hinted) return
    const owned = g.items?.hintscroll || 0
    if (owned <= 0) return
    sfx.tap()
    setG(useItem(g, 'hintscroll'))
    setHinted(true)
  }

  const useExplainScroll = () => {
    if (phase !== 'ask' || explained) return
    const owned = g.items?.explainscroll || 0
    if (owned <= 0) return
    sfx.tap()
    setG(useItem(g, 'explainscroll'))
    setExplained(true)
  }

  const isFrozen = Date.now() < frozenUntil
  const owned = (id) => g.items?.[id] || 0

  // Semua bantuan cuma bisa diakses lewat tombol "Bantuan" — muncul saat user
  // memang lagi butuh, bukan berjejer terus di layar bikin gatel dipencet.
  // `block` = alasan tombolnya mati sekarang (null berarti siap dipakai).
  const lifelines = [
    { id: 'fifty',         run: use5050,          block: !p.choices ? t('help.only_mc', g.lang) : p.choices.length < 3 ? t('help.too_few', g.lang) : hiddenChoices.length ? t('help.already_used', g.lang) : null },
    { id: 'askai',         run: useAskAi,         block: aiLoading ? t('help.ai_loading', g.lang) : aiExplain ? t('help.already_used', g.lang) : null },
    { id: 'hintscroll',    run: useHintScroll,    block: hinted ? t('help.hint_open', g.lang) : null },
    { id: 'explainscroll', run: useExplainScroll, block: explained ? t('help.explain_open', g.lang) : null },
    { id: 'freeze',        run: useFreeze,        block: !useTimer ? t('help.no_timer', g.lang) : isFrozen ? t('help.timer_frozen', g.lang) : null },
    { id: 'reroll',        run: useReroll,        block: i >= list.length - 1 ? t('help.last_problem', g.lang) : null },
    { id: 'heartpotion',   run: useHeartPotion,   block: g.hearts >= 5 ? t('help.full_hearts', g.lang) : null },
    { id: 'shieldpotion',  run: useShieldPotion,  block: g.shieldActive ? t('help.shield_active', g.lang) : null },
    { id: 'doublexp',      run: useDoubleXp,      block: g.doubleXp > 0 ? t('help.xp_boost_active', g.lang) : null },
    { id: 'energydrink',   run: useEnergyDrink,   block: null },
  ].map((it) => ({ ...shopItem(it.id), ...it, left: owned(it.id) })).filter((it) => it.left > 0)

  const readyCount = lifelines.filter((it) => !it.block).length

  return (
    <div className="screen session-screen" ref={screenRef}>
      {/* ── Header: compact resource bar ────────────────────────────────── */}
      <div className="ss-head">
        <button className="ss-back" onClick={() => setShowQuit(true)} aria-label="Keluar">
          <Icon name="x" size={20} />
        </button>

        <div className="ss-title">{plan.title}</div>

        {/* Timer ring — compact */}
        {useTimer && phase === 'ask' && (
          <div className="ss-timer" data-overtime={isOvertime || undefined}>
            <svg width={38} height={38} viewBox="0 0 38 38">
              <circle cx={19} cy={19} r={15} fill="none" stroke="var(--line)" strokeWidth={3} />
              <circle cx={19} cy={19} r={15} fill="none" stroke={isOvertime ? 'var(--red)' : timeLeft > maxTime * 0.5 ? 'var(--green)' : timeLeft > maxTime * 0.25 ? 'var(--gold)' : 'var(--red)'}
                strokeWidth={3} strokeLinecap="round"
                strokeDasharray={`${(2 * Math.PI * 15) * (timeLeft / maxTime)} ${2 * Math.PI * 15}`}
                transform="rotate(-90 19 19)"
                style={{ transition: 'stroke-dasharray 0.8s linear, stroke 0.3s' }} />
            </svg>
            <span className="ss-timer-num">{timeLeft}</span>
          </div>
        )}

        {/* Hearts atau skor */}
        {useHearts ? (
          <div className="ss-hearts">
            {Array.from({ length: 5 }).map((_, k) => (
              <motion.span key={k} animate={k < hearts ? { scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 0.3 }}>
                <Icon name="heart" size={16} fill={k < hearts ? 'var(--red)' : 'none'}
                  color={k < hearts ? 'var(--red)' : 'var(--line)'} />
              </motion.span>
            ))}
          </div>
        ) : plan.kind === 'defense' ? (
          <span className="ss-hp"><Icon name="shield" size={14} />{hp}</span>
        ) : (
          <span className="ss-score">{tally.correct}/{list.length}</span>
        )}
      </div>

      {/* ── Sub-header: progress bar + combo + badge ────────────────────── */}
      <div className="ss-sub">
        <div className="ss-bar">
          <motion.i style={{ width: `${(i / list.length) * 100}%` }}
            animate={{ width: `${(i / list.length) * 100}%` }} />
        </div>
        <div className="ss-meta">
          {p.variant !== 'plain' && <span className="ss-badge">{VARIANT_NAME[p.variant]}</span>}
          {p.skill && <span className="ss-badge ss-badge--dim">{p.skill}</span>}
          <AnimatePresence>
            {combo >= 3 && (
              <motion.span className="ss-badge ss-badge--fire"
                initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}>
                <Icon name="zap" size={12} /> {tf('session.combo', g.lang, { n: combo })}
              </motion.span>
            )}
            {comeback && (
              <motion.span className="ss-badge ss-badge--gold"
                initial={{ scale: 0.3 }} animate={{ scale: 1 }}>
                <Icon name="ph:arrow-u-up-right-fill" size={12} /> {t('session.comeback_ready', g.lang)}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Ultimate tier indicator ──────────────────────────────────── */}
      {isUltimate && currentTier && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
          <span className={`ultimate-tier ${currentTier}`}>
            <Icon name={currentTier === 'easy' ? 'ph:seedling-fill' : currentTier === 'mid' ? 'ph:fire-fill' : 'ph:lightning-fill'} size={12} />
            {t(`ultimate.tier_${currentTier}`, g.lang)}
            {' · '}{i < tiers.easy ? `${i + 1}/${tiers.easy}` : i < tiers.easy + tiers.mid ? `${i - tiers.easy + 1}/${tiers.mid}` : `${i - tiers.easy - tiers.mid + 1}/${tiers.adv}`}
          </span>
        </div>
      )}

      {/* ── Focus timer bar ────────────────────────────────────────────── */}
      {isFocus && focusTotal > 0 && (
        <div className="focus-timer-bar">
          <div className="focus-timer-track">
            <motion.i style={{ width: `${focusPct * 100}%`, background: focusColor }}
              animate={{ width: `${focusPct * 100}%` }}
              transition={{ duration: 1, ease: 'linear' }} />
          </div>
          <span className="focus-timer-num" style={{ color: focusColor }}>
            <Icon name="ph:timer-fill" size={12} />
            {Math.floor(focusLeft / 60)}:{(focusLeft % 60).toString().padStart(2, '0')}
          </span>
        </div>
      )}

      {/* ── HUD tantangan: skor + pengganda combo + target ───────────────── */}
      {isChallenge && (
        <div className="ch-hud">
          <div className="ch-hud-score">
            <Icon name="ph:trophy-fill" size={15} color="var(--gold)" />
            <motion.b key={score} initial={{ scale: 1.35 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 16 }}>{score}</motion.b>
            <span className="ch-hud-target">/ {target}</span>
          </div>
          <div className="ch-hud-mult" data-hot={combo >= 2 || undefined}>
            <span>×{comboMult(combo)}</span>
            <span className="ch-hud-mult-bar">
              <i style={{ width: `${Math.min(100, (combo / 6) * 100)}%` }} />
            </span>
          </div>
        </div>
      )}
      {isChallenge && (
        <div className="ch-hud-track">
          <i style={{ width: `${Math.min(100, (score / target) * 100)}%` }} />
        </div>
      )}

      {/* ── Angka skor melayang ──────────────────────────────────────────── */}
      <AnimatePresence>
        {scorePop && (
          <motion.div className="ch-pop" style={{ color: scorePop.color }}
            initial={{ opacity: 0, y: 8, scale: 0.7 }}
            animate={{ opacity: 1, y: -26, scale: 1 }}
            exit={{ opacity: 0, y: -54, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
            {scorePop.text}
            {scorePop.mult > 1 && <span className="ch-pop-mult">{tf('ch.combo_pop', g.lang, { n: scorePop.mult })}</span>}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Flash timeout ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {timeoutFlash && (
          <motion.div className="ss-flash"
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Icon name="clock" size={16} /> {tf('session.timeout', g.lang, { n: OVERTIME_SEC })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Kartu soal ───────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div key={i} ref={cardRef} className="ss-card"
          initial={{ opacity: 0, x: 50, rotateY: 8 }}
          animate={{ opacity: 1, x: 0, rotateY: 0 }}
          exit={{ opacity: 0, x: -50, rotateY: -8 }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}>
          {/* Nomor soal + indikator kesulitan */}
          <div className="ss-card-head">
            <span className="ss-qno">{tf('session.q_of', g.lang, { i: i + 1, n: list.length })}</span>
          </div>

          <div className={'ss-problem' + (p.text.length > 34 ? ' ss-problem--word' : '')}>
            {p.text}
          </div>
          {p.display && <div className="ss-display">{p.display}</div>}
          {p.visual && <Dots v={p.visual} />}

          {/* Pilihan atau input */}
          <div className="ss-answer-area">
            {p.choices ? (
              <div className="ss-choices">
                {p.choices.filter((c) => !hiddenChoices.includes(String(c))).map((c, idx) => {
                  const isCorrect = phase !== 'ask' && String(c) === String(p.answer)
                  const isWrong = phase === 'wrong' && String(c) === String(input)
                  return (
                    <motion.button key={String(c)}
                      whileTap={{ scale: 0.94 }}
                      disabled={phase !== 'ask'}
                      className={'ss-opt' + (isCorrect ? ' ok' : '') + (isWrong ? ' no' : '')}
                      onClick={() => { setInput(String(c)); submit(String(c)) }}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.06 }}>
                      <span className="ss-opt-letter">{'ABCD'[idx]}</span>
                      <span className="ss-opt-val">{typeof c === 'number' ? fmt(c) : c}</span>
                      {isCorrect && <Icon name="check-circle" size={20} color="var(--green)" />}
                      {isWrong && <Icon name="x-circle" size={20} color="var(--red)" />}
                    </motion.button>
                  )
                })}
              </div>
            ) : (
              <>
                <div className={'ss-input' + (phase === 'right' ? ' ok' : '') + (phase === 'wrong' ? ' no' : '')}>
                  {phase === 'wrong' ? (
                    <span className="ss-input-correct">{fmt(p.answer)}</span>
                  ) : (
                    input || <span className="ss-input-hint">ketik jawaban…</span>
                  )}
                </div>
                {phase === 'ask' && (
                  <div className="ss-keypad">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'del'].map((k) => (
                      <motion.button key={k} className="ss-key" whileTap={{ scale: 0.88 }}
                        onClick={() => tapKey(k)} aria-label={k === 'del' ? 'Hapus' : k}>
                        {k === 'del' ? <Icon name="rotate-ccw" size={18} /> : k}
                      </motion.button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Hint / AI / Langkah */}
          {hinted && phase === 'ask' && (
            <motion.div className="ss-hint" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
              <Icon name="help-circle" size={16} /> {p.hint}
            </motion.div>
          )}
          {aiLoading && (
            <div className="ss-hint" style={{ color: 'var(--violet)' }}>
              <Icon name="ph:robot-fill" size={16} /> {t('session.ai_thinking_short', g.lang)}
            </div>
          )}
          {aiExplain && phase === 'ask' && (
            <motion.div className="ss-hint" style={{ color: 'var(--violet)' }}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Icon name="ph:robot-fill" size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{aiExplain}</span>
            </motion.div>
          )}
          {/* Tips AI saat salah — visual, 2 metode, non-blocking */}
          {phase === 'wrong' && !tipsDismissed && (
            <motion.div className="wrong-tips"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}>
              {tipsLoading ? (
                <div className="wrong-tips-loading">
                  <motion.span className="wrong-tips-spin"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>
                    <Icon name="ph:circle-fill" size={6} color="var(--violet)" />
                  </motion.span>
                  <span>{t('session.ai_tips_loading', g.lang)}</span>
                </div>
              ) : wrongTips ? (
                <>
                  <div className="wrong-tips-head">
                    <span className="wrong-tips-badge">
                      <Icon name="ph:star-fill" size={14} color="var(--gold)" />
                      {t('session.ai_tips_title', g.lang)}
                    </span>
                    <button className="wrong-tips-dismiss" onClick={() => setTipsDismissed(true)}
                      aria-label={t('session.skip', g.lang)}>
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                  <div className="wrong-tips-cols">
                    {wrongTips.map((tip, idx) => (
                      <motion.div key={idx} className="wrong-tip-card"
                        initial={{ opacity: 0, x: idx === 0 ? -12 : 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.15 + idx * 0.12, type: 'spring', stiffness: 240, damping: 22 }}>
                        <div className="wrong-tip-icon" style={{ background: idx === 0 ? 'rgba(100,180,255,.12)' : 'rgba(255,180,60,.12)' }}>
                          <Icon name={idx === 0 ? 'ph:book-fill' : 'ph:lightning-fill'}
                            size={16} color={idx === 0 ? '#6ab4ff' : 'var(--gold)'} />
                        </div>
                        <div className="wrong-tip-body">
                          <b className="wrong-tip-title">{tip.title}</b>
                          <ol className="wrong-tip-steps">
                            {tip.steps.map((s, k) => <li key={k}>{s}</li>)}
                          </ol>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              ) : (
                <motion.ol className="ss-steps" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
                  {p.why.map((w, k) => <li key={k}>{w}</li>)}
                </motion.ol>
              )}
            </motion.div>
          )}
          {explained && phase !== 'wrong' && (
            <motion.ol className="ss-steps" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}>
              {p.why.map((w, k) => <li key={k}>{w}</li>)}
            </motion.ol>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Status item aktif ────────────────────────────────────────────── */}
      <div className="ss-buffs">
        {g.shieldActive && (
          <motion.span className="ss-buff" style={{ color: '#8d7bff' }}
            animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.8, repeat: Infinity }}>
            <Icon name="ph:shield-star-fill" size={13} /> Tameng
          </motion.span>
        )}
        {g.doubleXp > 0 && (
          <span className="ss-buff" style={{ color: '#ffc86b' }}>
            <Icon name="ph:lightning-fill" size={13} /> 2× XP ({g.doubleXp}×)
          </span>
        )}
        {isFrozen && (
          <motion.span className="ss-buff" style={{ color: '#6bd5ff' }}
            animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 0.8, repeat: Infinity }}>
            <Icon name="ph:snowflake-fill" size={13} /> Beku {Math.ceil((frozenUntil - Date.now()) / 1000)}s
          </motion.span>
        )}
      </div>

      {/* ── Aksi bawah ───────────────────────────────────────────────────── */}
      {phase === 'ask' ? (
        <div className="ss-actions">
          {!p.choices && (
            <motion.button className="btn btn-start" disabled={!input}
              onClick={() => submit(input)}
              animate={input ? { boxShadow: ['0 4px 0 #7a4e00, 0 6px 16px rgba(0,0,0,.4)', '0 4px 0 #7a4e00, 0 6px 28px rgba(232,160,0,.4)', '0 4px 0 #7a4e00, 0 6px 16px rgba(0,0,0,.4)'] } : {}}
              transition={{ duration: 1.5, repeat: Infinity }}>
              <Icon name="check" size={20} /> {t('session.verify', g.lang)}
            </motion.button>
          )}

          {/* Satu pintu buat semua bantuan — dibuka cuma kalau user emang butuh */}
          <button className="ss-help-btn" onClick={() => { sfx.tap(); setShowHelp(true) }}>
            <Icon name="ph:lifebuoy-fill" size={18} />
            <span>{t('session.need_help', g.lang)}</span>
            {readyCount > 0
              ? <span className="ss-help-dot">{readyCount}</span>
              : <span className="ss-help-dot ss-help-dot--empty">0</span>}
          </button>
        </div>
      ) : (
        <motion.button className="btn btn-start" onClick={next}
          style={{ background: phase === 'right' ? 'var(--green)' : 'var(--gold)' }}
          initial={{ scale: 0.92 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
          {phase === 'right' ? (
            <><Icon name="check" size={20} /> {tf('session.mantap', g.lang, { n: gained.current })}</>
          ) : dead ? (
            t('session.rest', g.lang)
          ) : (
            <>{comeback ? <><Icon name="ph:fire-fill" size={18} /> {t('session.comeback', g.lang)}</> : t('session.next', g.lang)} <Icon name="chevron-right" size={20} /></>
          )}
        </motion.button>
      )}

      {/* ── Sheet bantuan: semua item dipakai dari sini ───────────────────── */}
      <AnimatePresence>
        {showHelp && (
          <motion.div className="modal-backdrop help-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowHelp(false)}>
            <motion.div className="help-sheet" onClick={(e) => e.stopPropagation()}
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32, mass: .9 }}>
              <span className="help-grip" />
              <motion.div className="between"
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: .08 }}>
                <div className="row" style={{ gap: 8 }}>
                  <motion.div
                    animate={{ rotate: [0, -10, 10, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: .3 }}>
                    <Icon name="ph:lifebuoy-fill" size={22} color="var(--gold)" />
                  </motion.div>
                  <b style={{ fontSize: 16, color: 'var(--ink)' }}>{t('session.need_help', g.lang)}</b>
                </div>
                <motion.button className="pill icon-btn" onClick={() => setShowHelp(false)} aria-label="Tutup"
                  whileHover={{ scale: 1.08 }} whileTap={{ scale: .9 }}>
                  <Icon name="x" size={16} />
                </motion.button>
              </motion.div>

              {lifelines.length === 0 ? (
                <motion.div className="help-empty"
                  initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: .15 }}>
                  <motion.div
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}>
                    <Icon name="ph:bag-fill" size={40} color="var(--dim)" />
                  </motion.div>
                  <p>{t('session.help_empty', g.lang)}</p>
                </motion.div>
              ) : (
                <>
                  <motion.p style={{ fontSize: 12 }}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: .1 }}>{t('session.help_hint', g.lang)}</motion.p>
                  <div className="help-list">
                    {lifelines.map((it, i) => (
                      <motion.button key={it.id} className="help-item" disabled={!!it.block}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: .12 + i * .07, type: 'spring', stiffness: 300, damping: 24 }}
                        whileTap={it.block ? undefined : { scale: .97 }}
                        onClick={() => { it.run(); setShowHelp(false) }}>
                        <span className="help-item-icon" style={{ background: `${it.color}1a`, color: it.color }}>
                          <motion.div
                            animate={{ scale: [1, 1.15, 1] }}
                            transition={{ duration: 1.8, repeat: Infinity, delay: i * .5 }}>
                            <Icon name={it.icon} size={20} />
                          </motion.div>
                        </span>
                        <span className="help-item-text">
                          <b>{t(it.nameKey, g.lang)}</b>
                          <small className={it.block ? 'help-item-block' : undefined}>{it.block || t(it.descKey, g.lang)}</small>
                        </span>
                        <span className="help-item-n" style={{ color: it.block ? 'var(--dim)' : it.color }}>×{it.left}</span>
                      </motion.button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal konfirmasi keluar ──────────────────────────────────────── */}
      <AnimatePresence>
        {showQuit && (
          <motion.div className="modal-backdrop" style={{ zIndex: 60 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowQuit(false)}>
            <motion.div className="ss-quit-modal"
              initial={{ opacity: 0, scale: .85, y: 24, filter: 'blur(3px)' }}
              animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scale: .88, y: 16, filter: 'blur(2px)' }}
              onClick={(e) => e.stopPropagation()}
              transition={{ type: 'spring', stiffness: 340, damping: 28, mass: .85 }}>
              <motion.div className="ss-quit-icon"
                initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 350, damping: 16, delay: .05 }}>
                <motion.div style={{
                  position: 'absolute', inset: -8, borderRadius: '50%',
                  background: 'radial-gradient(circle, rgba(255,122,107,.15) 0%, transparent 70%)',
                }} animate={{ scale: [1, 1.2, 1], opacity: [.5, .15, .5] }}
                  transition={{ duration: 2, repeat: Infinity }} />
                <motion.div
                  animate={{ x: [0, 3, -3, 0] }}
                  transition={{ duration: .5, delay: .2 }}>
                  <Icon name="ph:door-open-fill" size={36} color="var(--gold)" />
                </motion.div>
              </motion.div>
              <motion.h2 initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: .1 }}>{t('session.quit_title', g.lang)}</motion.h2>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: .14 }}>{tf('session.quit_body', g.lang, { n: QUIT_XP_PENALTY })}</motion.p>
              <motion.div className="ss-quit-btns"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: .18 }}>
                <motion.button className="btn ghost" onClick={() => setShowQuit(false)}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: .96 }}>
                  {t('session.quit_stay', g.lang)}
                </motion.button>
                <motion.button className="btn soft" onClick={confirmQuit}
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: .96 }}
                  style={{ background: 'linear-gradient(180deg, #4a2020, #2a1010)', border: '1px solid #6a3030', boxShadow: '0 4px 0 #1a0a0a' }}>
                  {tf('session.quit_go', g.lang, { n: QUIT_XP_PENALTY })}
                </motion.button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
