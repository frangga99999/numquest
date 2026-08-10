import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Icon from './Icon.jsx'
import { api, loggedIn } from './api.js'
import { army, fortressHp, DOMAINS } from './engine.js'
import { dayKey } from './engine.js'
import { sfx } from './sound.js'
import { t, tf } from './i18n.js'

// Pertahanan Kerajaan berjalan tiap 2 pekan — tanggalnya sama untuk semua orang,
// dihitung dari kalender, bukan disimpan di server.
export function defenseWindow(d = new Date()) {
  const period = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000 / 14)
  const start = new Date((period * 14 + 1) * 86400000)
  const active = Math.floor(Date.now() / 86400000) - period * 14 <= 2
  return { period, active, start }
}

export default function Arena({ g, onSignIn, onStartDefense }) {
  const [league, setLeague] = useState(null)
  const [world, setWorld] = useState(null)
  const [err, setErr] = useState('')
  const units = army(g)
  const ev = defenseWindow()
  const doneToday = g.defenseDay === dayKey()

  useEffect(() => {
    api.world().then(setWorld).catch(() => {})
    if (loggedIn()) api.league().then(setLeague).catch((e) => setErr(e.message))
  }, [])

  return (
    <div className="screen">
      <h1>{t('arena.page_title', g.lang)}</h1>

      <div className={'card' + (ev.active ? ' glow' : '')}>
        <div className="between">
          <h3>{t('arena.defense_title', g.lang)}</h3>
          <span className={'tag' + (ev.active ? ' hot' : '')}>{ev.active ? t('arena.defense_active', g.lang) : t('arena.defense_waiting', g.lang)}</span>
        </div>
        <p style={{ marginTop: 8 }}>
          {t('arena.defense_desc', g.lang)}
        </p>
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <Icon name="shield" size={18} color="var(--gold)" />
          <b>{fortressHp(g)} {t('arena.hp_label', g.lang)}</b>
          <small className="grow">{t('arena.hp_detail', g.lang)}</small>
        </div>
        <button className="btn" style={{ marginTop: 12 }} disabled={!ev.active || doneToday} onClick={() => { sfx.levelup(); onStartDefense() }}>
          <Icon name="shield" size={18} /> {doneToday ? t('arena.defense_done', g.lang) : ev.active ? t('arena.defense_start', g.lang) : t('arena.defense_next', g.lang)}
        </button>
      </div>

      <h3>{t('arena.troops', g.lang)}</h3>
      <div className="card">
        {units.map((u) => (
          <div className="skill" key={u.domain}>
            <div className={'ring' + (u.level >= 4 ? ' gold' : u.level >= 2 ? ' silver' : '')}><Icon name={u.icon} size={14} /></div>
            <div className="grow">
              <b>{u.name}</b>
              <div><small>{u.role} · {DOMAINS[u.domain].name}</small></div>
            </div>
            <div className="center">
              <b>{u.power}</b><div><small>{t('arena.unit_power', g.lang)}</small></div>
            </div>
          </div>
        ))}
        <small>{t('arena.troops_note', g.lang)}</small>
      </div>

      <h3>{t('arena.league', g.lang)}</h3>
      {!loggedIn() ? (
        <div className="card stack">
          <p>{t('arena.league_desc', g.lang)}</p>
          <button className="btn soft" onClick={onSignIn}><Icon name="user-plus" size={18} /> {t('settings.sign_in', g.lang)}</button>
        </div>
      ) : err ? (
        <div className="card err row" style={{ gap: 8 }}><Icon name="alert-circle" size={17} /> {err}</div>
      ) : league ? (
        <div className="card">
          <div className="between">
            <b className="row" style={{ gap: 8 }}><Icon name="award" size={18} color="var(--gold)" /> {league.tier}</b>
            <small>{t('arena.ranking', g.lang)} {league.rank} {t('arena.of', g.lang)} {league.members.length}</small>
          </div>
          <div style={{ marginTop: 10 }}>
            {league.members.map((m) => (
              <motion.div className="skill" key={m.handle} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                style={m.me ? { background: 'rgba(244,185,66,.08)', borderRadius: 10 } : undefined}>
                <div className={'ring' + (m.rank <= league.promoteAt ? ' gold' : '')}>{m.rank}</div>
                <b className="grow">{m.handle}{m.me ? ` (${t('arena.you', g.lang)})` : ''}</b>
                <small>{m.xp} XP</small>
              </motion.div>
            ))}
          </div>
          <small>{t('arena.league_promo', g.lang)}</small>
        </div>
      ) : (
        <div className="card"><small>{t('arena.loading', g.lang)}</small></div>
      )}

      <h3>{t('arena.world_map', g.lang)}</h3>
      <div className="card">
        {world ? (
          <>
            <div className="grid g3">
              <div className="stat"><b>{world.pemain}</b><span>{t('arena.players', g.lang)}</span></div>
              <div className="stat"><b>{world.klan}</b><span>{t('arena.clans', g.lang)}</span></div>
              <div className="stat"><b>{world.soalTotal}</b><span>{t('arena.world_problems', g.lang)}</span></div>
            </div>
            {!!world.teratas?.length && (
              <div style={{ marginTop: 12 }}>
                <small>{t('arena.top_clan', g.lang)}</small>
                {world.teratas.map((c) => (
                  <div className="skill" key={c.name}>
                    <div className="ring"><Icon name="users" size={14} /></div>
                    <b className="grow">{c.name}</b><small>{c.xp} XP</small>
                  </div>
                ))}
              </div>
            )}
            <small>{t('arena.no_rank_note', g.lang)}</small>
          </>
        ) : (
          <small>{t('arena.offline', g.lang)}</small>
        )}
      </div>
    </div>
  )
}
