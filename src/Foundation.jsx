import React, { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { Shape, Button as RetroButton } from './design-system/RetroUI.jsx'
import { dayKey } from './engine.js'
import { push } from './store.js'
import { FOUNDATION_CONCEPTS, conceptById, foundationOf, makeExercise, exampleExercise, explanation, hintFor, masteryFor, recommendation, reviewQueue, startFoundation, recordFoundationAnswer, foundationHelp, completeFoundation, summarizeFoundation, rangeDates } from './foundations.js'
import './foundation.css'

const Arrow = () => <Icon name="chevron-right" size={19} />
const Button = ({ children, secondary, ...props }) => <RetroButton className={`fn-button${secondary ? ' fn-secondary' : ''}`} variant={secondary ? 'secondary' : 'primary'} {...props}>{children}</RetroButton>
const Eyebrow = ({ children }) => <span className="fn-eyebrow">{children}</span>
const Heading = ({ eyebrow, title, text }) => <div className="fn-heading"><Eyebrow>{eyebrow}</Eyebrow><h1>{title}</h1>{text && <p>{text}</p>}</div>
const DIAGNOSTIC_IDS = ['quantity', 'addition', 'subtraction', 'multiplication', 'division']

function Brand() {
  return <span className="fn-brand"><span className="fn-brand-mark" aria-hidden="true"><i /><i /><i /><i /></span><span>numquest<span className="fn-brand-caption">RUANG UNTUK BERTUMBUH</span></span></span>
}

function ProgressBar({ value, label }) {
  return <div className="fn-meter" role="progressbar" aria-label={label} aria-valuenow={Math.min(100, Math.round(value))} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${Math.min(100, value)}%` }} /></div>
}

function Visual({ exercise: e, interactive = true }) {
  const [marked, setMarked] = useState([])
  const [rounds, setRounds] = useState(0)
  const count = e.visual === 'count' ? e.a : e.visual === 'add' ? e.a + e.b : e.a
  const groupCount = e.visual === 'groups' ? e.a : e.b
  const groupSize = e.visual === 'groups' ? e.b : e.answer
  const grouped = ['groups', 'divide'].includes(e.visual)
  const toggle = i => setMarked(m => m.includes(i) ? m.filter(v => v !== i) : [...m, i])
  return <div className="fn-visual">
    {grouped ? <>
      <div className="fn-groups" style={{ '--groups': groupCount }}>
        {Array.from({ length: groupCount }, (_, i) => <button key={i} type="button" disabled={!interactive} className={`fn-group ${marked.includes(i) ? 'is-marked' : ''}`} aria-pressed={marked.includes(i)} aria-label={`Kelompok ${i + 1}, ${e.visual === 'divide' ? rounds : groupSize} benda`} onClick={() => toggle(i)}>
          <span className="fn-dot-grid">{Array.from({ length: e.visual === 'divide' ? rounds : groupSize }, (_, j) => <span key={j} className="fn-dot" />)}</span>
          <small>Kelompok {i + 1}</small>
        </button>)}
      </div>
      {e.visual === 'divide' && <div className="fn-distribute"><p aria-live="polite">{e.a - rounds * e.b} kartu belum dibagikan</p><Button secondary disabled={rounds === groupSize} onClick={() => setRounds(r => Math.min(groupSize, r + 1))}>{rounds === groupSize ? 'Semua sudah terbagi rata' : 'Bagikan satu putaran'}<Icon name="plus" size={16} /></Button>{rounds > 0 && <button className="fn-text-button" onClick={() => setRounds(0)}>Ulangi pembagian</button>}</div>}
      {e.visual === 'groups' && <p className="fn-visual-caption">{e.a} kelompok · masing-masing {e.b} benda</p>}
    </> : <>
      <div className="fn-count-grid">{Array.from({ length: count }, (_, i) => {
        const removed = e.visual === 'sub' && i >= e.answer
        return <button key={i} disabled={removed || !interactive} aria-label={`Titik ${i + 1}${removed ? ', diambil' : ''}`} aria-pressed={marked.includes(i)} className={`fn-counter ${e.visual === 'add' && i >= e.a ? 'is-second' : ''} ${removed ? 'is-removed' : ''} ${marked.includes(i) ? 'is-marked' : ''}`} onClick={() => toggle(i)}>{removed ? '×' : marked.includes(i) ? <Icon name="check" size={16} /> : ''}</button>
      })}</div><p className="fn-visual-caption">{e.visual === 'sub' ? `${e.b} titik dicoret. Hitung yang masih utuh.` : 'Ketuk titik untuk menandai yang sudah dihitung.'}</p>
    </>}
  </div>
}

function Art() {
  return <div className="fn-art retro-math-art" aria-hidden="true"><Shape kind="clover" className="retro-clover"/><span className="retro-math-symbol">×</span><span className="retro-math-orbit">+</span><span className="retro-art-caption">MAKE ROOM<br/>FOR YOUR MIND.</span><Shape kind="spark" className="retro-spark"/></div>
}

function ConceptRow({ concept: c, f, onStart, index }) {
  const m = masteryFor(f, c.id), done = f.concepts[c.id]?.completed
  return <button className="fn-concept-row" onClick={() => onStart(c.id)}>
    <span className={`fn-concept-icon fn-domain-${c.domain}`}>{c.symbol}</span>
    <span className="fn-concept-copy"><span className="fn-row-overline">{String(index + 1).padStart(2, '0')} · {c.minutes} menit</span><strong>{c.title}</strong><small>{done ? m.status : c.description}</small></span>
    {done ? <span className="fn-complete-icon"><Icon name="check" size={18} /></span> : <Arrow />}
  </button>
}

function Home({ f, onStart, onDiagnostic, onNavigate, onAcademy }) {
  const next = recommendation(f), completed = FOUNDATION_CONCEPTS.filter(c => f.concepts[c.id]?.completed).length
  const today = summarizeFoundation(f, dayKey(), dayKey()), due = reviewQueue(f)
  const active = f.active
  return <>
    <div className="retro-home-intro"><Heading eyebrow="ANGKA BUKAN LAWANMU." title={<>Main sebentar.<br />Makin <span className="retro-word">pintar<Shape kind="spark" /></span>.</>} text="Buka rasa ingin tahu. Bangun percaya diri. Satu soal setiap hari." /><span className="retro-edition">LATIHAN KECIL,<br/>KEMAJUAN BESAR.<span>↙</span></span></div>
    <div className="fn-home-grid"><section className="fn-hero">
      <div className="fn-hero-copy"><span className="fn-tag"><span /> {active ? 'LANJUTKAN SESIMU' : next.type === 'REVIEW' ? 'REVIEW RINGAN' : 'LANGKAH BERIKUTNYA'}</span>
        <h2>{active ? conceptById[active.conceptId].title : next.concept.title}</h2><p>{active ? 'Langkah terakhir sudah tersimpan. Lanjutkan saat kamu siap.' : next.reason}</p>
        <div className="fn-hero-meta"><span><Icon name="clock" size={15} /> ± {active ? conceptById[active.conceptId].minutes : next.concept.minutes} menit</span><span><Icon name="eye" size={16} /> Panduan visual</span></div>
        <Button onClick={() => onStart(active?.conceptId || next.concept.id, active ? 'resume' : next.type === 'REVIEW' ? 'review' : 'learn')}>{active ? 'Lanjutkan belajar' : 'Mulai belajar'}<Arrow /></Button>
      </div><Art />
    </section>
    <section className="fn-goal-card"><div className="fn-section-title"><Eyebrow>RUANG HARI INI</Eyebrow><Icon name="sun" size={20} /></div><div className="fn-goal-value">{Math.floor(today.seconds / 60)}<span> / {f.preferences.minutes} menit</span></div><p>Waktu latihan aktif</p><ProgressBar value={today.seconds / (f.preferences.minutes * 60) * 100} label="Target waktu latihan hari ini" /><small>Target adalah arah. Kamu boleh berhenti dan kembali kapan saja.</small><button className="fn-text-button" onClick={() => onNavigate('more')}>Atur target <Arrow /></button></section></div>
    <button className="fn-academy-banner" onClick={onAcademy}><span className="retro-academy-mark"><Shape kind="spark"/></span><span><small>DUA JALUR. SATU LANGKAH MAJU.</small><strong>Aritmatika atau psikotes?<br/>Pilih tantanganmu.</strong><span>16 modul · dasar hingga mahir · tantangan AI</span></span><span className="retro-arrow" aria-hidden="true">↗</span></button>
    {!f.diagnostic && <button className="fn-diagnostic-banner" onClick={onDiagnostic}><span className="fn-banner-icon"><Icon name="compass" size={23} /></span><span><strong>Temukan titik mulai yang nyaman</strong><small>5 pertanyaan ringan. Boleh dilewati, tanpa batas waktu.</small></span><Arrow /></button>}
    <div className="fn-section-title"><div><Eyebrow>JALUR BELAJARMU</Eyebrow><h2>Bangun fondasi yang kuat</h2></div><button className="fn-text-button" onClick={() => onNavigate('path')}>Lihat semua <Arrow /></button></div>
    <div className="fn-path-preview">{FOUNDATION_CONCEPTS.slice(1, 5).map((c, i) => <ConceptRow key={c.id} concept={c} f={f} index={i + 1} onStart={onStart} />)}</div>
    <div className="fn-bottom-grid"><section className="fn-note"><Icon name="message-square" size={22} /><div><Eyebrow>CATATAN PENDAMPING</Eyebrow><p>“Saat lupa jawaban, kamu selalu boleh kembali melihat polanya. Memahami juga bagian dari kemajuan.”</p><small>Panduan belajar NumQuest</small></div></section><section className="fn-small-summary"><span><strong>{completed}<small> / {FOUNDATION_CONCEPTS.length}</small></strong><small>pelajaran selesai</small></span><span><strong>{due.length}</strong><small>review tersedia</small></span><button className="fn-text-button" onClick={() => onNavigate('progress')}>Lihat perkembangan <Arrow /></button></section></div>
  </>
}

function Path({ f, onStart }) {
  const due = reviewQueue(f), completed = FOUNDATION_CONCEPTS.filter(c => f.concepts[c.id]?.completed).length
  return <><Heading eyebrow="MULAI DARI FONDASI" title="Langkah kecil, arah yang jelas." text="Pilih konsep yang ingin kamu bangun. Setiap pelajaran bisa diulang dengan tenang." />
    <section className="fn-surface"><div className="fn-section-title"><h2>Perjalanan fondasi</h2><span>{completed} / {FOUNDATION_CONCEPTS.length} selesai</span></div><ProgressBar value={completed / FOUNDATION_CONCEPTS.length * 100} label="Penyelesaian pelajaran" /><p className="fn-fineprint">Pelajaran selesai menunjukkan aktivitas. Pemahaman dinilai dari latihan mandiri berikutnya.</p></section>
    {due.length > 0 && <section className="fn-surface"><Eyebrow>REVIEW TERSEDIA</Eyebrow>{due.map(c => <button className="fn-review-row" key={c.id} onClick={() => onStart(c.id, 'review')}><Icon name="rotate-ccw" size={18} /><span>{c.title}</span><span>3 soal</span><Arrow /></button>)}</section>}
    <div className="fn-path-list">{FOUNDATION_CONCEPTS.map((c, i) => <ConceptRow key={c.id} concept={c} f={f} onStart={onStart} index={i} />)}</div>
    <p className="fn-fineprint">Materi lanjutan, seperti pecahan dan persen, tersedia di pustaka belajar melalui menu Lainnya.</p>
  </>
}

function Progress({ f, onStart, onPreferences }) {
  const [range, setRange] = useState(f.preferences.range), [custom, setCustom] = useState(f.preferences.customRange || rangeDates('7'))
  const [appliedCustom, setAppliedCustom] = useState(custom)
  const applyCustom = e => { e.preventDefault(); const values = new FormData(e.currentTarget); const next = { start: values.get('start'), end: values.get('end') }; setCustom(next); setAppliedCustom(next); onPreferences({ customRange: next }) }
  const dates = range === 'custom' ? appliedCustom : rangeDates(range)
  const invalid = !dates.start || !dates.end || dates.start > dates.end || dates.end > dayKey()
  const stats = summarizeFoundation(f, dates.start, dates.end)
  const due = reviewQueue(f)
  const scheduled = FOUNDATION_CONCEPTS.filter(c => f.concepts[c.id]?.reviewDue != null).sort((a, b) => f.concepts[a.id].reviewDue - f.concepts[b.id].reviewDue)
  const sessions = f.sessions.filter(s => s.date >= dates.start && s.date <= dates.end).slice().reverse()
  return <><Heading eyebrow="PERKEMBANGAN PRIBADI" title="Lihat sejauh kamu melangkah." text="Aktivitas, pemahaman, dan kelancaran punya ceritanya masing-masing." />
    <div className="fn-range-picker" aria-label="Periode progres">{[['1', 'Hari ini'], ['7', '7 hari'], ['30', '30 hari'], ['custom', 'Pilih tanggal']].map(([id, label]) => <button key={id} aria-pressed={range === id} onClick={() => { setRange(id); onPreferences({ range: id }) }}>{label}</button>)}</div>
    {range === 'custom' && <form className="fn-date-fields" onSubmit={applyCustom} noValidate><label>Dari<input name="start" type="date" value={custom.start} max={custom.end} onChange={e => setCustom({ ...custom, start: e.target.value })} /></label><label>Sampai<input name="end" type="date" value={custom.end} min={custom.start} max={dayKey()} onChange={e => setCustom({ ...custom, end: e.target.value })} /></label><Button type="submit">Terapkan</Button></form>}
    {invalid ? <p role="alert" className="fn-feedback">Pilih rentang tanggal yang lengkap dan berurutan, sampai hari ini.</p> : <>
      <div className="fn-stats-grid">{[[Math.floor(stats.seconds / 60), 'Menit latihan aktif', 'clock'], [stats.sessions, 'Sesi selesai', 'book-open'], [stats.accuracy === null ? '—' : `${stats.accuracy}%`, 'Akurasi jawaban pertama', 'target'], [stats.activeDays, 'Hari berlatih', 'calendar']].map(([v, label, icon]) => <div className="fn-stat-card" key={label}><Icon name={icon} size={20} /><strong>{v}</strong><span>{label}</span></div>)}</div>
      {!stats.attempts && <div className="fn-empty"><Icon name="activity" size={28} /><h2>Belum ada latihan di periode ini</h2><p>Perkembangan akan muncul setelah kamu mulai berlatih.</p><Button secondary onClick={() => onStart(recommendation(f).concept.id)}>Mulai satu langkah <Arrow /></Button></div>}
      <div className="fn-section-title"><div><Eyebrow>PEMAHAMAN TERKINI</Eyebrow><h2>Setiap konsep punya ritmenya</h2></div></div><p className="fn-fineprint">Estimasi penguasaan memakai setidaknya 6 jawaban mandiri dari 2 sesi. Nilai terkini tidak mengikuti filter tanggal. Waktu respons ditampilkan terpisah.</p>
      <div className="fn-mastery-list">{FOUNDATION_CONCEPTS.map(c => { const m = masteryFor(f, c.id); return <button className="fn-mastery-row" key={c.id} onClick={() => onStart(c.id)}><span className={`fn-concept-icon fn-domain-${c.domain}`}>{c.symbol}</span><span><strong>{c.short}</strong><small>{m.status}{m.medianSeconds != null ? ` · median ${m.medianSeconds} dtk/jawaban` : ''}</small></span><b>{m.score === null ? '—' : `${m.score}%`}</b><Arrow /></button> })}</div>
      <div className="fn-section-title"><h2>Riwayat sesi</h2><span>{sessions.length} sesi</span></div>
      <div className="fn-surface">{sessions.length ? sessions.map(s => <div className="fn-history-row" key={s.id}><span><strong>{conceptById[s.conceptId].title}</strong><small>{new Date(s.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })} · {s.kind === 'review' ? 'Review' : 'Belajar'}</small></span><span>{s.independent}/{s.total} mandiri<small>{s.mastery === null ? 'Mengumpulkan bukti' : `Penguasaan saat itu: ${s.mastery}%`}</small></span></div>) : <p>Belum ada sesi selesai pada periode ini.</p>}</div>
    </>}
    <div className="fn-section-title"><h2>Review berikutnya</h2><span>{due.length} jatuh tempo</span></div><section className="fn-surface">{scheduled.length ? scheduled.map(c => <button className="fn-review-row" key={c.id} onClick={() => onStart(c.id, 'review')}><Icon name="rotate-ccw" size={17} /><span>{c.title}<small className="fn-review-date">{f.concepts[c.id].reviewDue <= Date.now() ? 'Siap direview hari ini' : new Date(f.concepts[c.id].reviewDue).toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}</small></span><Arrow /></button>) : <p>Jadwal review akan terbentuk setelah sesi selesai.</p>}</section>
  </>
}

function Diagnostic({ f, update, onClose, onStart }) {
  const answers = f.diagnosticDraft || [], index = answers.length
  const [input, setInput] = useState('')
  const [complete, setComplete] = useState(false)
  const answer = correct => {
    const next = [...answers, { conceptId: DIAGNOSTIC_IDS[index], correct }]
    update(g => { const state = foundationOf(g); return { ...g, foundation: { ...state, diagnosticDraft: next.length === 5 ? [] : next, ...(next.length === 5 ? { diagnostic: { answers: next, completedAt: Date.now() } } : {}) } } })
    setInput(''); if (next.length === 5) setComplete(true)
  }
  if (complete) {
    const next = recommendation(f)
    return <div className="fn-study-wrap"><Heading eyebrow="TITIK MULAI DITEMUKAN" title="Kita mulai dari sini." text="Ini petunjuk awal untuk memilih materi. Pemahaman akan terlihat lebih jelas selama belajar." /><section className="fn-surface">{f.diagnostic.answers.map(a => <div className="fn-history-row" key={a.conceptId}><strong>{conceptById[a.conceptId].short}</strong><span>{a.correct === null ? 'Belum dicoba' : a.correct ? 'Awal yang bisa dibangun' : 'Mari lihat bersama'}</span></div>)}</section><Button onClick={() => onStart(next.concept.id)}>Pelajari {next.concept.short.toLowerCase()} <Arrow /></Button><Button secondary onClick={onClose}>Kembali ke beranda</Button></div>
  }
  const e = makeExercise(DIAGNOSTIC_IDS[index], 0, 1)
  return <div className="fn-study-wrap"><div className="fn-study-top"><button className="fn-text-button" onClick={onClose}><Icon name="x" size={18} /> Simpan & keluar</button><span>{index + 1} dari 5</span></div><ProgressBar value={index / 5 * 100} label="Pemetaan awal" /><Heading eyebrow="TEMUKAN TITIK MULAI" title="Coba dengan cara yang nyaman." text="Gunakan gambar jika membantu. Kamu juga boleh melewati pertanyaan ini." /><section className="fn-exercise-card"><Eyebrow>{conceptById[e.conceptId].short}</Eyebrow><h2>{e.text}</h2><Visual key={e.id} exercise={e} /><form onSubmit={ev => { ev.preventDefault(); if (input.trim()) answer(Number(input) === e.answer) }}><label className="fn-answer-label" htmlFor="diagnostic-answer">Jawabanmu</label><input id="diagnostic-answer" className="fn-answer-input" inputMode="numeric" pattern="[0-9]*" value={input} placeholder="Tulis angka" onChange={ev => setInput(ev.target.value.replace(/[^0-9]/g, '').slice(0, 4))} /><Button disabled={!input.trim()} type="submit">Lanjutkan <Arrow /></Button></form><button className="fn-text-button" onClick={() => answer(null)}>Belum tahu, lewati dulu</button></section></div>
}

function useActiveSeconds(key) {
  const elapsed = useRef(0), last = useRef(Date.now()), recent = useRef(Date.now())
  useEffect(() => {
    elapsed.current = 0; last.current = Date.now(); recent.current = Date.now()
    const activity = () => { recent.current = Date.now() }
    const tick = () => { const now = Date.now(); if (!document.hidden && now - recent.current < 60000) elapsed.current += Math.min(2, (now - last.current) / 1000); last.current = now }
    const timer = setInterval(tick, 1000)
    document.addEventListener('pointerdown', activity); document.addEventListener('keydown', activity)
    return () => { clearInterval(timer); document.removeEventListener('pointerdown', activity); document.removeEventListener('keydown', activity) }
  }, [key])
  return () => { const value = Math.round(elapsed.current); elapsed.current = 0; return value }
}

function Study({ g, update, onClose, onComplete }) {
  const f = foundationOf(g), a = f.active, c = conceptById[a.conceptId]
  const [input, setInput] = useState(''), [showHelp, setShowHelp] = useState(false), [showVisual, setShowVisual] = useState(false)
  const consumeSeconds = useActiveSeconds(`${a.sessionId}:${a.phase}:${a.index}:${a.attempt}`)
  const e = makeExercise(c.id, a.index, a.seed)
  const patch = fields => update(state => { const f = foundationOf(state); return { ...state, foundation: { ...f, active: { ...f.active, ...fields } } } })
  const advance = () => {
    if (a.index === 2) { update(state => completeFoundation(state)); onComplete(a.conceptId); return }
    patch({ index: a.index + 1, attempt: 1, answered: false, assisted: false, feedback: null }); setInput(''); setShowHelp(false); setShowVisual(false)
  }
  const help = () => { update(state => foundationHelp(state)); setShowHelp(true); setShowVisual(true) }
  const practice = a.phase === 'practice'
  return <div className="fn-study-wrap"><div className="fn-study-top"><button className="fn-text-button" onClick={onClose}><Icon name="x" size={18} /> Simpan & keluar</button><span>{practice ? `Latihan ${a.index + 1} / 3` : `Panduan ${a.step + 1} / 3`}</span></div><ProgressBar value={practice ? 50 + a.index / 3 * 50 : a.step / 3 * 50} label="Langkah sesi belajar" />
    <Heading eyebrow={`${c.short.toUpperCase()} · ${a.kind === 'review' ? 'REVIEW' : 'MULAI DARI FONDASI'}`} title={practice ? 'Sekarang, giliranmu.' : c.title} text={practice ? 'Ambil waktumu. Bantuan selalu tersedia.' : c.target} />
    {!practice ? <section className="fn-exercise-card"><div className="fn-mentor-message" aria-live="polite"><Icon name="message-square" size={21} /><p>{c.steps[a.step]}</p></div><Visual key={`${c.id}:example`} exercise={exampleExercise(c.id)} />{a.step === 2 && <p className="fn-equation-note">{explanation(exampleExercise(c.id))}</p>}<div className="fn-study-actions">{a.step > 0 && <Button secondary onClick={() => patch({ step: a.step - 1 })}>Sebelumnya</Button>}<Button onClick={() => a.step === 2 ? patch({ phase: 'practice' }) : patch({ step: a.step + 1 })}>{a.step === 2 ? 'Coba 3 latihan' : 'Lanjut perlahan'}<Arrow /></Button></div></section> : <section className="fn-exercise-card"><Eyebrow>{e.dimension === 'calculation' ? 'COBA DENGAN ANGKA' : e.dimension === 'application' ? 'CONTOH SEHARI-HARI' : 'LIHAT DAN PAHAMI'}</Eyebrow><h2>{e.text}</h2>
      {(e.dimension !== 'calculation' || showVisual || a.assisted) && <Visual key={`${a.sessionId}:${a.index}`} exercise={e} />}
      {!a.answered ? <><form onSubmit={ev => { ev.preventDefault(); if (input.trim()) update(state => recordFoundationAnswer(state, Number(input), consumeSeconds())) }}><label htmlFor="foundation-answer" className="fn-answer-label">Jawabanmu</label><input id="foundation-answer" className="fn-answer-input" inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={input} onChange={ev => setInput(ev.target.value.replace(/[^0-9]/g, '').slice(0, 4))} placeholder="Tulis angka" /><Button type="submit" disabled={!input.trim()}>Periksa jawaban <Arrow /></Button></form><button className="fn-text-button" onClick={help}><Icon name="help-circle" size={17} /> Bantu aku melihat polanya</button>{(showHelp || a.assisted) && <p className="fn-hint" role="status">{hintFor(e)}</p>}</> : <div className={`fn-feedback ${a.feedback.correct ? 'is-correct' : ''}`} role="status"><div className="fn-feedback-heading"><Icon name={a.feedback.correct ? 'check' : 'eye'} size={22} /><h3>{a.feedback.correct ? 'Ya, hubungan angkanya tepat.' : 'Mari lihat satu langkah lagi.'}</h3></div><p>{a.feedback.explanation}</p><div className="fn-study-actions">{!a.feedback.correct && <Button secondary onClick={() => { patch({ answered: false, feedback: null, attempt: a.attempt + 1, assisted: true }); setInput(''); setShowVisual(true) }}>Coba lagi</Button>}<Button onClick={advance}>{a.index === 2 ? 'Selesaikan sesi' : 'Soal berikutnya'}<Arrow /></Button></div></div>}
    </section>}
    <p className="fn-study-footer"><Icon name="heart" size={15} /> Tidak perlu terburu-buru. Kamu boleh beristirahat kapan saja.</p>
  </div>
}

function Summary({ f, conceptId, onClose, onProgress, onStart }) {
  const session = f.sessions.at(-1), c = conceptById[conceptId], next = recommendation(f)
  return <div className="fn-study-wrap fn-summary"><span className="fn-summary-mark"><Icon name="check" size={36} /></span><Heading eyebrow="SATU LANGKAH SELESAI" title="Terima kasih sudah mencoba." text={`Hari ini kamu berlatih ${c.short.toLowerCase()}. Kamu boleh merasa cukup untuk hari ini.`} /><section className="fn-surface"><p>{c.target}</p><div className="fn-summary-stats"><span><strong>{session?.total || 0}</strong>soal dicoba</span><span><strong>{session?.independent || 0}</strong>benar tanpa bantuan</span></div><p className="fn-fineprint">Jawaban dengan bantuan tetap bagian dari belajar. Penguasaan akan diestimasi setelah ada cukup latihan mandiri.</p></section><Button onClick={onClose}>Cukup untuk hari ini <Icon name="check" size={17} /></Button><Button secondary onClick={onProgress}>Lihat perkembangan <Arrow /></Button><button className="fn-text-button" onClick={() => onStart(next.concept.id, next.type === 'REVIEW' ? 'review' : 'learn')}>Masih ingin belajar? {next.concept.short} <Arrow /></button></div>
}

function More({ f, onPreferences, onLegacy, onDiagnostic }) {
  return <><Heading eyebrow="SESUAIKAN RUANGMU" title="Belajar yang terasa nyaman." text="Atur target ringan dan jelajahi materi lain saat kamu siap." /><section className="fn-surface fn-settings"><h2>Target latihan harian</h2><p>Mulai kecil. Ubah kapan pun kamu membutuhkan ritme yang berbeda.</p><div className="fn-range-picker">{[5, 10, 15, 20].map(n => <button key={n} aria-pressed={f.preferences.minutes === n} onClick={() => onPreferences({ minutes: n })}>{n} menit</button>)}</div><label className="fn-toggle"><span><strong>Kurangi gerakan</strong><small>Transisi yang lebih tenang saat belajar.</small></span><input type="checkbox" checked={f.preferences.reducedMotion} onChange={e => onPreferences({ reducedMotion: e.target.checked })} /></label><small>Tersimpan di perangkat ini. Akun yang sudah terhubung memakai sinkronisasi aplikasi yang tersedia.</small></section>
    <section className="fn-surface"><h2>Mulai dari titik yang berbeda</h2><p>Pemetaan awal boleh dicoba ulang. Riwayat belajarmu tetap tersimpan.</p><Button secondary onClick={onDiagnostic}>Coba pemetaan awal <Icon name="compass" size={18} /></Button></section>
    <div className="fn-section-title"><h2>Jelajahi NumQuest</h2></div><div className="fn-explore-grid">{[['design-system', 'grid', 'Playground UI kit', 'Warna, bentuk, komponen, dan interaksi NumQuest.'], ['academy', 'target', 'Akademi berhitung', 'Aritmatika dan psikotes, dasar hingga mahir.'], ['learn', 'book-open', 'Pustaka belajar', 'Materi dan penjelasan lebih lanjut.'], ['home', 'grid', 'Latihan lengkap', 'Pilihan latihan dan tantangan yang sudah tersedia.'], ['progress', 'trending-up', 'Progres keseluruhan', 'Aktivitas dari seluruh latihan NumQuest.']].map(([id, icon, title, desc]) => <button className="fn-explore-card" key={id} onClick={() => onLegacy(id)}><Icon name={icon} size={24} /><strong>{title}</strong><p>{desc}</p><Arrow /></button>)}</div>
  </>
}

export default function Foundation({ g, setG, onLegacy }) {
  const f = foundationOf(g)
  const [page, setPage] = useState('home'), [screen, setScreen] = useState('main'), [summaryId, setSummaryId] = useState(null)
  const [pendingStart, setPendingStart] = useState(null)
  const mainRef = useRef(null)
  const update = fn => setG(state => fn(state))
  useEffect(() => { if (g.foundation) { const t = setTimeout(() => push(g), 700); return () => clearTimeout(t) } }, [g.foundation]) // Existing account sync; local persistence is handled by useGame.
  useEffect(() => { window.scrollTo(0, 0); mainRef.current?.focus({ preventScroll: true }) }, [page, screen])
  const navigate = id => { setPendingStart(null); setPage(id); setScreen('main') }
  const start = (id, kind = 'learn') => {
    if (f.active && (f.active.conceptId !== id || kind !== 'resume')) { setPendingStart({ id, kind }); return }
    if (kind !== 'resume' || !f.active) update(state => startFoundation(state, id, kind))
    setScreen('study')
  }
  const preferences = patch => update(state => { const f = foundationOf(state); return { ...state, foundation: { ...f, preferences: { ...f.preferences, ...patch } } } })
  const openDiagnostic = () => setScreen('diagnostic')
  const studying = screen !== 'main'
  return <div className="fn-app pr-system" data-reduced-motion={f.preferences.reducedMotion || g.reducedMotion}>
    <a href="#foundation-main" className="fn-skip-link">Langsung ke isi</a>
    <aside className="fn-sidebar"><Brand /><div className="fn-sidebar-label">RUANG BELAJARMU</div><nav aria-label="Navigasi utama">{[['home', 'home', 'Hari ini'], ['path', 'map', 'Jalur belajar'], ['progress', 'activity', 'Perkembangan'], ['more', 'grid', 'Lainnya']].map(([id, icon, label]) => <button key={id} className="fn-nav-item" aria-current={!studying && page === id ? 'page' : undefined} onClick={() => navigate(id)}><Icon name={icon} size={21} /><span>{label}</span></button>)}</nav><div className="fn-sidebar-note"><span className="fn-leaf-mark" aria-hidden="true">↗</span><strong>Ruang untuk bertumbuh.</strong><p>Setiap orang punya ritmenya sendiri. Ini ruang untuk ritmemu.</p></div><button className="fn-version retro-kit-link" onClick={() => onLegacy('design-system')}>PLAYGROUND / UI KIT ↗</button></aside>
    <div className="fn-workspace"><header className="fn-header"><span className="fn-mobile-brand"><Brand /></span><span className="fn-header-breadcrumb">Ruang belajar <span>/</span> {studying ? 'Mulai dari Fondasi' : { home: 'Hari ini', path: 'Jalur belajar', progress: 'Perkembangan', more: 'Preferensi' }[page]}</span><button className="fn-profile-button" onClick={() => navigate('more')} aria-label="Buka preferensi belajar"><span className="fn-header-date">{new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long' })}</span><Icon name="settings" size={19} /></button></header>
      <main className="fn-main" id="foundation-main" ref={mainRef} tabIndex={-1}>
        {pendingStart ? <div className="fn-study-wrap"><Heading eyebrow="ADA SESI YANG TERSIMPAN" title="Pilih langkah berikutnya." text={`Kamu sedang belajar ${conceptById[f.active.conceptId].short.toLowerCase()}. Melanjutkan sesi ini menjaga langkah terakhirmu.`} /><Button onClick={() => { setPendingStart(null); setScreen('study') }}>Lanjutkan sesi tersimpan <Arrow /></Button><Button secondary onClick={() => { update(state => startFoundation(state, pendingStart.id, pendingStart.kind)); setPendingStart(null); setScreen('study') }}>Mulai sesi baru</Button><p className="fn-fineprint">Memulai sesi baru mengganti langkah yang belum selesai. Riwayat jawaban tetap tersimpan.</p></div> : <>
        {screen === 'diagnostic' && <Diagnostic f={f} update={update} onClose={() => navigate('home')} onStart={start} />}
        {screen === 'study' && f.active && <Study g={g} update={update} onClose={() => navigate('home')} onComplete={id => { setSummaryId(id); setScreen('summary') }} />}
        {screen === 'summary' && <Summary f={f} conceptId={summaryId} onClose={() => navigate('home')} onProgress={() => navigate('progress')} onStart={start} />}
        
        {screen === 'main' && page === 'home' && <Home f={f} onStart={start} onDiagnostic={openDiagnostic} onNavigate={navigate} onAcademy={() => onLegacy('academy')} />}
        {screen === 'main' && page === 'path' && <Path f={f} onStart={start} />}
        {screen === 'main' && page === 'progress' && <Progress f={f} onStart={start} onPreferences={preferences} />}
        {screen === 'main' && page === 'more' && <More f={f} onPreferences={preferences} onLegacy={onLegacy} onDiagnostic={openDiagnostic} />}
        </>}
        <footer className="fn-footer"><span /> Belajar memahami, selangkah demi selangkah.</footer>
      </main>
    </div>
  </div>
}
