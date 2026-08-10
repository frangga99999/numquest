import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from './Icon.jsx'
import { api, loggedIn } from './api.js'
import { sfx } from './sound.js'
import { t, tf } from './i18n.js'

export default function Clan({ g, setG, onSignIn, onStartWar }) {
  const [data, setData] = useState(null)
  const [list, setList] = useState([])
  const [q, setQ] = useState('')
  const [name, setName] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = async () => {
    if (!loggedIn()) return
    try {
      const d = await api.clan()
      setData(d)
      setG((s) => ({ ...s, clanId: d.clan?.id || null }))
      if (!d.clan) setList((await api.clans(q)).clans)
    } catch (e) { setErr(e.message) }
  }

  useEffect(() => { refresh() }, []) // eslint-disable-line

  const act = (fn) => async () => {
    setBusy(true); setErr('')
    try { await fn(); await refresh() } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  if (!loggedIn())
    return (
      <div className="screen" style={{ justifyContent: 'center' }}>
        <div className="center"><Icon name="users" size={44} color="var(--gold)" /></div>
        <h1 className="center">{t('clan.need_account', g.lang)}</h1>
        <p className="center">{t('clan.need_account_body', g.lang)}</p>
        <button className="btn" onClick={onSignIn}><Icon name="user-plus" size={18} /> {t('settings.sign_in', g.lang)}</button>
      </div>
    )

  const war = data?.war

  if (!data?.clan)
    return (
      <div className="screen">
        <h1>{t('clan.find', g.lang)}</h1>
        <p>{t('clan.desc', g.lang)}</p>
        {err && <div className="card err row" style={{ gap: 8 }}><Icon name="alert-circle" size={17} /> {err}</div>}

        <div className="card stack">
          <h3>{t('clan.create_own', g.lang)}</h3>
          <input className="input" placeholder={t('clan.name_ph', g.lang)} value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
          <button className="btn" disabled={busy || name.trim().length < 3} onClick={act(() => api.createClan({ name: name.trim() }))}>
            <Icon name="plus" size={18} /> {t('clan.create_btn', g.lang)}
          </button>
        </div>

        <div className="row">
          <input className="input grow" placeholder={t('clan.search_ph', g.lang)} value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn soft" style={{ width: 'auto' }} onClick={act(async () => setList((await api.clans(q)).clans))}>{t('clan.search_btn', g.lang)}</button>
        </div>

        <div className="stack">
          {list.map((c) => (
            <motion.div key={c.id} className="card between" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
              <div>
                <b>{c.name}</b>
                <div><small>{tf('clan.member_count', g.lang, { n: c.members, xp: c.weekXp })}</small></div>
                {c.motto && <small>{c.motto}</small>}
              </div>
              <button className="btn soft" style={{ width: 'auto' }} disabled={busy} onClick={act(() => api.joinClan(c.id))}>{t('clan.join', g.lang)}</button>
            </motion.div>
          ))}
          {!list.length && <small className="center">{t('clan.no_clan', g.lang)}</small>}
        </div>
      </div>
    )

  const c = data.clan
  const isLeader = c.members.find((m) => m.handle === g.handle)?.role === 'leader'

  return (
    <div className="screen">
      <div className="between">
        <div><h1>{c.name}</h1><small>{tf('clan.member_count', g.lang, { n: c.members.length, xp: c.weekXp })}</small></div>
        <button className="pill icon-btn" title={t('clan.leave', g.lang)} disabled={busy} onClick={act(() => api.leaveClan())}><Icon name="log-out" size={17} /></button>
      </div>
      {c.motto && <p>{c.motto}</p>}
      {err && <div className="card err row" style={{ gap: 8 }}><Icon name="alert-circle" size={17} /> {err}</div>}

      {c.challenge && (
        <div className="card">
          <h3>{t('clan.challenge_title', g.lang)}</h3>
          <p style={{ color: 'var(--ink)', marginTop: 6 }}>{c.challenge}</p>
          {c.goal > 0 && (
            <>
              <div className="bar" style={{ marginTop: 10 }}><i style={{ width: `${Math.min(100, (c.weekXp / c.goal) * 100)}%` }} /></div>
              <small>{tf('clan.xp_progress', g.lang, { n: c.weekXp, goal: c.goal })}</small>
            </>
          )}
        </div>
      )}

      <div className="card">
        <div className="between"><h3>{t('clan.war', g.lang)}</h3><small>{war?.week || t('clan.this_week', g.lang)}</small></div>
        {war ? (
          <>
            <div className="between" style={{ marginTop: 12 }}>
              <div className="center grow"><b style={{ fontSize: 26 }}>{war.us.stars}</b><div><small>{war.us.name}</small></div></div>
              <Icon name="crosshair" size={22} color="var(--dim)" />
              <div className="center grow"><b style={{ fontSize: 26 }}>{war.them.stars}</b><div><small>{war.them.name}</small></div></div>
            </div>
            <p style={{ marginTop: 10 }}>{t('clan.war_desc', g.lang)}</p>
            <button className="btn" style={{ marginTop: 12 }} onClick={() => { sfx.levelup(); onStartWar() }}><Icon name="crosshair" size={18} /> {t('clan.war_start', g.lang)}</button>
          </>
        ) : (
          <p style={{ marginTop: 8 }}>{t('clan.no_opponent', g.lang)}</p>
        )}
      </div>

      {isLeader && (
        <div className="card stack">
          <h3>{t('clan.war_setup', g.lang)}</h3>
          <input className="input" placeholder={t('clan.war_challenge_ph', g.lang)} maxLength={120}
            onKeyDown={(e) => e.key === 'Enter' && act(() => api.setChallenge({ text: e.target.value, goal: 5000 }))()} />
          <small>{t('clan.war_hint', g.lang)}</small>
        </div>
      )}

      <h3>{t('clan.members_title', g.lang)}</h3>
      <div className="card">
        {c.members.map((m) => (
          <div className="skill" key={m.handle}>
            <div className="ring"><Icon name={m.role === 'leader' ? 'award' : 'users'} size={14} /></div>
            <div className="grow"><b>{m.handle}</b><div><small>{m.role === 'leader' ? t('clan.leader', g.lang) : t('clan.member', g.lang)} · tingkat {m.level}</small></div></div>
            <small>{m.week_xp} XP</small>
          </div>
        ))}
      </div>

      <h3>{t('clan.chat_title', g.lang)}</h3>
      <div className="card stack chat">
        <AnimatePresence initial={false}>
          {data.chat.map((m, i) => (
            <motion.div key={`${m.at}-${i}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <b style={{ fontSize: 13, color: 'var(--gold)' }}>{m.handle}</b>{' '}
              <span style={{ fontSize: 14 }}>{m.body}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {!data.chat.length && <small>{t('clan.chat_empty', g.lang)}</small>}
      </div>
      <div className="row">
        <input className="input grow" placeholder={t('clan.chat_ph', g.lang)} value={msg} maxLength={300}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && msg.trim()) { act(() => api.chat(msg.trim()))(); setMsg('') } }} />
        <button className="btn soft icon-btn" style={{ width: 'auto' }} disabled={!msg.trim()}
          onClick={() => { act(() => api.chat(msg.trim()))(); setMsg('') }}><Icon name="send" size={18} /></button>
      </div>
      <small className="center">{t('clan.report', g.lang)}</small>
    </div>
  )
}
