import React, { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import gsap from 'gsap'
import Icon from './Icon.jsx'
import { DOMAINS, SKILLS, buildingLevels, mastery, BADGES } from './engine.js'
import { Emblem, GameBadge } from './GameUI.jsx'
import { sfx } from './sound.js'
import { burst } from './celebrate.js'
import { t, tf } from './i18n.js'

const TIER_KEYS = ['tier.empty', 'tier.wood', 'tier.stone', 'tier.iron', 'tier.gold', 'tier.crystal']

// type: 'shield' | 'item' (bantuan sesi, koleksi habis pakai) | 'cosmetic'
// (skin kerajaan, tidak mengubah soal — PRD 15.2. 'item' beda cerita: memang
// dirancang jadi lifeline terbatas, dijelaskan sendiri di deskripsinya.)
export const SHOP = [
  { id: 'shield', type: 'shield', name: 'Perisai runtutan', desc: 'Melindungi satu hari yang terlewat.', nameKey: 'kshop.shield.name', descKey: 'kshop.shield.desc', cost: 60, icon: 'shield' },
  { id: 'skin-dawn', type: 'cosmetic', name: 'Tema Fajar', desc: 'Warna kerajaan jadi keemasan.', nameKey: 'kshop.skin-dawn.name', descKey: 'kshop.skin-dawn.desc', cost: 150, icon: 'sunrise' },
  { id: 'skin-night', type: 'cosmetic', name: 'Tema Malam', desc: 'Warna kerajaan jadi biru dalam.', nameKey: 'kshop.skin-night.name', descKey: 'kshop.skin-night.desc', cost: 150, icon: 'moon' },
  { id: 'skin-forest', type: 'cosmetic', name: 'Tema Rimba', desc: 'Warna kerajaan jadi hijau lumut.', nameKey: 'kshop.skin-forest.name', descKey: 'kshop.skin-forest.desc', cost: 150, icon: 'sun' },
]

export default function Kingdom({ g, setG }) {
  const lv = buildingLevels(g)
  const wrap = useRef(null)

  useEffect(() => {
    if (g.reducedMotion || !wrap.current) return
    gsap.fromTo(wrap.current.querySelectorAll('.bld'),
      { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.05, ease: 'back.out(1.4)' })
  }, []) // eslint-disable-line

  const total = Object.values(lv).reduce((a, b) => a + b, 0)

  const buy = (item) => {
    if (g.coins < item.cost) return
    if (item.type === 'cosmetic' && g.skins.includes(item.id)) return
    if (item.type === 'shield' && g.shields >= 2) return
    sfx.coin()
    burst({ particleCount: 40, spread: 55 })
    if (item.type === 'shield') return setG({ ...g, coins: g.coins - item.cost, shields: Math.min(2, g.shields + 1) })
    setG({ ...g, coins: g.coins - item.cost, skins: [...g.skins, item.id], skin: item.id })
  }

  return (
    <div className="screen">
      <div className="between">
        <div><h1>{t('kingdom.page_title', g.lang)}</h1><p>{t('kingdom.page_sub', g.lang)}</p></div>
        <div className="pill row" style={{ gap: 6 }}><Icon name="home" size={15} /> {total}/50</div>
      </div>

      <div className="kingdom" ref={wrap}>
        {Object.entries(DOMAINS).map(([id, d]) => {
          const level = lv[id]
          const skills = SKILLS.filter((s) => s.domain === id)
          const gold = skills.filter((s) => mastery(g.skills[s.id]).tier === 'gold').length
          return (
            <motion.div key={id} className={'bld' + (level === 0 ? ' locked' : '')} whileTap={{ scale: 0.97 }}>
              <Emblem icon={level === 0 ? 'lock' : d.icon} level={level} size={40} />
              <b style={{ fontSize: 14, marginTop: 8, display: 'block' }}>{d.region}</b>
              <div><small>{d.name}</small></div>
              <div style={{ marginTop: 8 }}><span className={`tier t${Math.max(0, level - 1)}`}>{t(TIER_KEYS[level], g.lang)}</span></div>
              <div className="bar" style={{ marginTop: 8 }}><i style={{ width: `${(level / 5) * 100}%` }} /></div>
              <small>{gold}/{skills.length} {t('kingdom.gold_skills', g.lang)}</small>
            </motion.div>
          )
        })}
      </div>

      <h3>{t('kingdom.badges', g.lang)}</h3>
      <div className="grid g4">
        {BADGES.map((b) => {
          const has = g.badges.includes(b.id)
          return (
            <div key={b.id} className="stat" style={{ opacity: has ? 1 : 0.35 }} title={b.name}>
              <b><Icon name={b.icon} size={20} color={has ? 'var(--gold)' : 'var(--dim)'} /></b>
              <span>{b.name}</span>
            </div>
          )
        })}
      </div>

      <div className="between"><h3>{t('kingdom.customize', g.lang)}</h3><div className="pill row" style={{ gap: 6 }}><Icon name="disc" size={14} /> {g.coins}</div></div>
      <div className="card">
        {SHOP.map((item) => {
          const owned = item.type === 'cosmetic' && g.skins.includes(item.id)
          const atMax = item.type === 'shield' && g.shields >= 2
          const disabled = owned || atMax || g.coins < item.cost
          return (
            <div className="skill" key={item.id}>
              <div className="ring"><Icon name={item.icon} size={14} /></div>
              <div className="grow">
                <div className="row" style={{ gap: 6 }}><b>{t(item.nameKey, g.lang)}</b></div>
                <div><small>{t(item.descKey, g.lang)}</small></div>
              </div>
              <button className="btn soft" style={{ width: 'auto', minHeight: 40, padding: '0 12px' }}
                disabled={disabled} onClick={() => buy(item)}>
                {owned ? t('kingdom.owned', g.lang) : atMax ? t('kingdom.full', g.lang) : `${item.cost}`}
              </button>
            </div>
          )
        })}
        <small>{t('kingdom.cosmetic_note', g.lang)}</small>
      </div>

      <div className="card">
        <h3>{t('kingdom.treasury', g.lang)}</h3>
        <div className="grid g3" style={{ marginTop: 8 }}>
          <div className="stat"><b>{g.coins}</b><span>{t('kingdom.coins', g.lang)}</span></div>
          <div className="stat"><b>{g.xp}</b><span>{t('kingdom.xp', g.lang)}</span></div>
          <div className="stat"><b>{g.shields}</b><span>{t('kingdom.shields', g.lang)}</span></div>
        </div>
      </div>
    </div>
  )
}
