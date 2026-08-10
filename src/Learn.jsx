import React, { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from './Icon.jsx'
import { api } from './api.js'
import { DOMAINS } from './engine.js'
import LessonVisual from './LessonVisual.jsx'
import { GameBadge } from './GameUI.jsx'
import { sfx } from './sound.js'
import { t, tf } from './i18n.js'

// Halaman panduan. Seluruh isinya — judul, penjelasan, langkah, DAN spesifikasi
// visualnya — dikarang model lewat /api/lessons. Komponen di sini cuma penyaji.

const DOMAIN_STYLE = {
  ns:   { icon: 'ph:magnifying-glass-fill',       color: '#a0c8ff' },
  add:  { icon: 'ph:plus-circle-fill',            color: 'var(--op-add)' },
  sub:  { icon: 'ph:minus-circle-fill',           color: 'var(--op-sub)' },
  mul:  { icon: 'ph:x-circle-fill',               color: 'var(--op-mul)' },
  div:  { icon: 'ph:divide-fill',                 color: 'var(--op-div)' },
  frac: { icon: 'ph:chart-pie-slice-fill',        color: '#ff9f6b' },
  dec:  { icon: 'ph:currency-circle-dollar-fill', color: 'var(--green)' },
  pct:  { icon: 'ph:percent-fill',                color: '#ffc86b' },
  est:  { icon: 'ph:compass-fill',                color: '#6bd5ff' },
  real: { icon: 'ph:shopping-cart-fill',          color: '#c8a0ff' },
}
const styleOf = (d) => DOMAIN_STYLE[d] || { icon: 'ph:book-open-fill', color: 'var(--gold)' }
// DOMAINS di engine.js cuma punya nama Indonesia — halaman ini ikut bahasa user.
const DOMAIN_EN = {
  ns: 'Number sense', add: 'Addition', sub: 'Subtraction', mul: 'Multiplication', div: 'Division',
  frac: 'Fractions', dec: 'Decimals', pct: 'Percentage', est: 'Estimation', real: 'Real life',
}
const domainName = (d, lang) => (lang === 'en' ? DOMAIN_EN[d] : DOMAINS[d]?.name) || DOMAINS[d]?.name || d
const LEVEL_NAME = {
  id: { easy: 'Dasar', mid: 'Menengah', adv: 'Mahir' },
  en: { easy: 'Basic', mid: 'Intermediate', adv: 'Advanced' },
}

/* ============================ Kartu topik ============================== */
function TopicCard({ lesson, index, onOpen, lang }) {
  const st = styleOf(lesson.domain)
  return (
    <motion.button className="lc-card" style={{ '--tc': st.color }}
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, type: 'spring', stiffness: 260, damping: 24 }}
      whileTap={{ scale: 0.97 }} onClick={onOpen}>
      <div className="lc-card-top">
        <span className="lc-card-icon"><Icon name={st.icon} size={20} color={st.color} /></span>
        <span className="lc-card-domain">{domainName(lesson.domain, lang)}</span>
      </div>
      {/* pratinjau visual — kartu pun sudah bergambar, bukan cuma judul */}
      <div className="lc-card-viz"><LessonVisual spec={lesson.content.visual} /></div>
      <b className="lc-card-title">{lesson.title}</b>
      {lesson.content.hook && <span className="lc-card-hook">{lesson.content.hook}</span>}
      <span className="lc-card-go">{t('learn.open', lang)} <Icon name="chevron-right" size={13} /></span>
    </motion.button>
  )
}

/* =========================== Detail materi ============================= */
function LessonDetail({ lesson, onBack, lang }) {
  const { content } = lesson
  const st = styleOf(lesson.domain)
  const steps = content.steps || []
  const [step, setStep] = useState(0)          // stepper: dibuka satu per satu
  const last = step >= steps.length - 1

  return (
    <motion.div className="ld" style={{ '--tc': st.color }}
      initial={{ opacity: 0, x: 26 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -26 }}>

      <div className="ld-head">
        <button className="pill icon-btn" onClick={onBack} aria-label="Kembali">
          <Icon name="chevron-left" size={18} />
        </button>
        <div className="grow">
          <span className="ld-domain"><Icon name={st.icon} size={13} color={st.color} /> {domainName(lesson.domain, lang)}</span>
          <h2>{lesson.title}</h2>
        </div>
      </div>

      {content.hook && (
        <motion.div className="ld-hook" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Icon name="ph:lightbulb-filament-fill" size={18} color="var(--gold)" />
          <p>{content.hook}</p>
        </motion.div>
      )}

      {/* Panggung visual — bagian terbesar layar */}
      <motion.div className="ld-stage"
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.08, type: 'spring', stiffness: 220, damping: 24 }}>
        <LessonVisual spec={content.visual} />
      </motion.div>

      <p className="ld-intro">{content.intro}</p>

      {/* Langkah interaktif — dibuka bertahap biar tidak kebanjiran teks */}
      <div className="ld-steps">
        {steps.slice(0, step + 1).map((s, i) => (
          <motion.div key={i} className={'ld-step' + (i === step ? ' now' : '')}
            initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
            <span className="ld-step-n">{i + 1}</span>
            <div className="grow">
              {s.eq && <b className="ld-step-eq">{s.eq}</b>}
              <small>{s.text}</small>
            </div>
          </motion.div>
        ))}
        {!last && (
          <motion.button className="ld-next" onClick={() => { sfx.tap(); setStep((v) => v + 1) }}
            whileTap={{ scale: 0.97 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {tf('learn.next_step', lang, { n: step + 2 })} <Icon name="chevron-right" size={15} />
          </motion.button>
        )}
        {last && steps.length > 1 && (
          <motion.button className="ld-next ld-next--again" onClick={() => setStep(0)} whileTap={{ scale: 0.97 }}>
            <Icon name="rotate-ccw" size={14} /> {t('learn.again', lang)}
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {last && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="stack" style={{ gap: 10 }}>
            {content.tip && (
              <div className="ld-note ld-note--tip">
                <Icon name="ph:sparkle-fill" size={16} color="var(--gold)" />
                <div><b>{t('learn.tip', lang)}</b><p>{content.tip}</p></div>
              </div>
            )}
            {content.analogy && (
              <div className="ld-note ld-note--ana">
                <Icon name="ph:chat-circle-text-fill" size={16} color="var(--violet)" />
                <div><b>{t('learn.analogy', lang)}</b><p>{content.analogy}</p></div>
              </div>
            )}
            {content.why && (
              <div className="ld-note ld-note--why">
                <Icon name="ph:target-fill" size={16} color="var(--green)" />
                <div><b>{t('learn.why', lang)}</b><p>{content.why}</p></div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/* =============================== Chat ================================== */
function ChatPanel({ lesson, lang }) {
  const [msgs, setMsgs] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [chips, setChips] = useState([])
  const bottomRef = useRef(null)
  const lastSent = useRef('')

  // Pertanyaan pancingan mengikuti materi yang sedang dibuka
  useEffect(() => {
    setMsgs([]); setErr(''); setChips(lesson
      ? [t('learn.qa1', lang), t('learn.qa2', lang)]
      : [t('learn.q1', lang), t('learn.q2', lang), t('learn.q3', lang)])
  }, [lesson?.id, lang]) // eslint-disable-line

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }, [msgs, loading])

  const ask = async (text) => {
    const q = (text ?? input).trim()
    if (!q || loading) return
    lastSent.current = q
    const history = msgs.slice(-4).map((m) => ({ role: m.role, text: m.text }))
    setMsgs((m) => [...m, { role: 'user', text: q }])
    setInput(''); setErr(''); setChips([]); setLoading(true)
    try {
      const res = await api.learnChat(q, lesson?.title || '', history, lang)
      setMsgs((m) => [...m, { role: 'ai', text: res.reply }])
      setChips(res.followups || [])
    } catch (e) {
      // Ditampilkan apa adanya — kalau sambungan ke AI putus, harus kelihatan.
      setErr(e.message || t('learn.ai_error', lang))
    } finally { setLoading(false) }
  }

  return (
    <div className="lchat">
      <div className="lchat-head">
        <span className="lchat-avatar"><Icon name="ph:robot-fill" size={16} color="var(--violet)" /></span>
        <div className="grow">
          <b>{t('learn.chat_title', lang)}</b>
          <small>{lesson ? tf('learn.chat_about', lang, { t: lesson.title }) : t('learn.chat_any', lang)}</small>
        </div>
      </div>

      <div className="lchat-body">
        {msgs.length === 0 && !loading && !err && (
          <p className="lchat-empty">{t('learn.chat_empty', lang)}</p>
        )}
        {msgs.map((m, i) => (
          <motion.div key={i} className={'lchat-msg ' + m.role}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            {m.role === 'ai' && <span className="lchat-avatar sm"><Icon name="ph:robot-fill" size={12} color="var(--violet)" /></span>}
            <span className="lchat-bubble">{m.text}</span>
          </motion.div>
        ))}
        {loading && (
          <div className="lchat-msg ai">
            <span className="lchat-avatar sm"><Icon name="ph:robot-fill" size={12} color="var(--violet)" /></span>
            <span className="lchat-bubble lchat-typing">
              {[0, 1, 2].map((i) => (
                <motion.i key={i} animate={{ opacity: [0.25, 1, 0.25] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }} />
              ))}
            </span>
          </div>
        )}
        {err && (
          <div className="lchat-err">
            <Icon name="alert-circle" size={14} />
            <span>{err}</span>
            <button onClick={() => ask(lastSent.current)}>{t('learn.chat_retry', lang)}</button>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!!chips.length && !loading && (
        <div className="lchat-chips">
          {chips.map((c, i) => (
            <motion.button key={i} className="lchat-chip" onClick={() => ask(c)}
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.06 }}>
              {c}
            </motion.button>
          ))}
        </div>
      )}

      <div className="lchat-input">
        <input className="input" placeholder={t('learn.chat_ph', lang)} value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && ask()} />
        <button className="lchat-send" onClick={() => ask()} disabled={!input.trim() || loading} aria-label="Kirim">
          <Icon name="send" size={16} />
        </button>
      </div>
    </div>
  )
}

/* ============================ Halaman utama ============================ */
export default function Learn({ g }) {
  const [lessons, setLessons] = useState([])
  const [active, setActive] = useState(null)
  const [state, setState] = useState('loading')   // loading | ok | error
  const [meta, setMeta] = useState({})
  const [refreshing, setRefreshing] = useState(false)

  const lang = g.lang || 'id'

  const load = (refresh) => {
    if (refresh) setRefreshing(true); else setState('loading')
    api.lessons(g.level, lang, refresh)
      .then((d) => {
        setLessons(d.lessons || [])
        setMeta({ source: d.source, warning: d.warning, aiReady: d.aiReady })
        setState((d.lessons || []).length ? 'ok' : 'error')
      })
      .catch((e) => { setMeta({ warning: e.message }); setState('error') })
      .finally(() => setRefreshing(false))
  }

  useEffect(() => { load(false) }, [g.level, lang]) // eslint-disable-line

  const byAi = meta.source === 'ai'

  // Layar dibagi rata: separuh atas materi (grid kartu atau detail), separuh
  // bawah chat — jadi chat selalu kelihatan tanpa perlu gulung sampai bawah.
  return (
    <div className="screen learn-screen">
      <AnimatePresence mode="wait">
        {active ? (
          <div key={active.id} className="learn-split">
            <div className="learn-pane learn-pane--top">
              <LessonDetail lesson={active} onBack={() => setActive(null)} lang={lang} />
            </div>
            <div className="learn-pane learn-pane--chat">
              <ChatPanel lesson={active} lang={lang} />
            </div>
          </div>
        ) : (
          <motion.div key="list" className="learn-split" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="learn-pane learn-pane--top">
              <div className="lh">
                <div className="lh-row">
                  <div className="grow">
                    <h1>{t('learn.title', lang)}</h1>
                    <p>{t('learn.subtitle', lang)}</p>
                  </div>
                  <motion.button className="lh-refresh" onClick={() => load(true)} disabled={refreshing}
                    whileTap={{ scale: 0.92 }} aria-label={t('learn.refresh', lang)} title={t('learn.refresh', lang)}>
                    <motion.span animate={refreshing ? { rotate: 360 } : {}}
                      transition={refreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}>
                      <Icon name="rotate-ccw" size={16} />
                    </motion.span>
                  </motion.button>
                </div>
                <div className="lh-tags">
                  <GameBadge label={(LEVEL_NAME[lang] || LEVEL_NAME.id)[g.level] || g.level} color="var(--gold)" bg="rgba(244,185,66,.15)" />
                  {state === 'ok' && (
                    <span className={'lh-src' + (byAi ? ' ai' : '')}>
                      <Icon name={byAi ? 'ph:robot-fill' : 'ph:hard-drives-fill'} size={12} />
                      {byAi ? t('learn.by_ai', lang) : t('learn.by_local', lang)}
                    </span>
                  )}
                </div>
                {meta.warning && state === 'ok' && !byAi && (
                  <div className="lh-warn"><Icon name="alert-circle" size={13} /> {meta.warning}</div>
                )}
              </div>

              {state === 'loading' ? (
                <div className="lh-loading">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>
                    <Icon name="ph:robot-fill" size={40} color="var(--violet)" />
                  </motion.div>
                  <b>{t('learn.loading', lang)}</b>
                  <small>{t('learn.loading_sub', lang)}</small>
                </div>
              ) : state === 'error' ? (
                <div className="lh-loading">
                  <Icon name="ph:plug-fill" size={40} color="var(--red)" />
                  <b>{t('learn.error', lang)}</b>
                  <small>{meta.warning || t('learn.error_sub', lang)}</small>
                  <button className="btn soft" style={{ marginTop: 12, width: 'auto', padding: '0 18px' }} onClick={() => load(true)}>
                    {t('learn.retry', lang)}
                  </button>
                </div>
              ) : (
                <div className="lc-grid">
                  {lessons.map((l, i) => (
                    <TopicCard key={l.id} lesson={l} index={i} lang={lang} onOpen={() => { sfx.tap(); setActive(l) }} />
                  ))}
                </div>
              )}
            </div>
            <div className="learn-pane learn-pane--chat">
              <ChatPanel lesson={null} lang={lang} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
