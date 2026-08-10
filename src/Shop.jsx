import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from './Icon.jsx'
import { SHOP_ITEMS, ITEM_CAP, buyItem, useItem, claimDailyItem } from './store.js'
import { t, tf } from './i18n.js'

export default function Shop({ g, setG, onClose }) {
  const [bought, setBought] = useState(null)
  const dailyClaimed = g.dailyItemDay === new Date().toISOString().slice(0, 10)

  const buy = (item) => {
    const next = buyItem(g, item.id, item.cost)
    if (next === g) return // tidak cukup koin atau stok penuh
    setG(next)
    setBought(item.id)
    setTimeout(() => setBought(null), 1500)
  }

  const claimDaily = () => {
    const next = claimDailyItem(g)
    setG(next)
    setBought(next._lastDailyItem)
    setTimeout(() => setBought(null), 1800)
  }

  return (
    <div className="screen" style={{ paddingBottom: 110 }}>
      <div className="duo-header">
        <div>
          <h1 style={{ fontSize: 28, letterSpacing: '-.03em' }}>{t('shop.page_title', g.lang)}</h1>
          <p style={{ fontSize: 13 }}>{t('shop.page_sub', g.lang)}</p>
        </div>
        <button className="pill icon-btn" onClick={onClose} aria-label="Tutup">
          <Icon name="x" size={18} />
        </button>
      </div>

      {/* Saldo */}
      <div className="shop-balance">
        <Icon name="ph:coin-fill" size={22} color="#ffc86b" />
        <span className="shop-balance-num">{g.coins}</span>
        <span style={{ fontSize: 11, color: 'var(--dim)', fontWeight: 600 }}>{t('shop.coins_label', g.lang)}</span>
      </div>

      {/* Klaim harian */}
      <motion.button
        className="shop-daily"
        onClick={claimDaily}
        disabled={dailyClaimed}
        whileTap={dailyClaimed ? undefined : { scale: 0.96 }}
        style={{ opacity: dailyClaimed ? 0.45 : 1, cursor: dailyClaimed ? 'not-allowed' : 'pointer' }}
      >
        <Icon name="ph:gift-fill" size={28} color={dailyClaimed ? 'var(--dim)' : '#ff6bcc'} />
        <div style={{ textAlign: 'left', flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: dailyClaimed ? 'var(--dim)' : 'var(--ink)' }}>{t('shop.daily_gift', g.lang)}</div>
          <div style={{ fontSize: 11, color: 'var(--dim)' }}>{dailyClaimed ? t('shop.daily_claimed', g.lang) : t('shop.daily_desc', g.lang)}</div>
        </div>
        {!dailyClaimed && <span className="tag" style={{ background: 'rgba(255,107,204,.2)', color: '#ff6bcc' }}>{t('shop.free', g.lang)}</span>}
        {dailyClaimed && <Icon name="check" size={18} color="var(--dim)" />}
      </motion.button>

      {/* Daftar item */}
      <div className="shop-grid">
        {SHOP_ITEMS.map((item) => {
          const owned = g.items?.[item.id] || 0
          const canBuy = g.coins >= item.cost && owned < ITEM_CAP
          const justBought = bought === item.id

          return (
            <motion.div key={item.id} className="shop-card"
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
              <div className="shop-card-icon" style={{ background: `${item.color}18`, color: item.color }}>
                <Icon name={item.icon} size={28} />
              </div>
              <div className="shop-card-info">
                <b style={{ fontSize: 14, color: 'var(--ink)' }}>{t(item.nameKey, g.lang)}</b>
                <small style={{ color: 'var(--dim)', lineHeight: 1.3 }}>{t(item.descKey, g.lang)}</small>
              </div>
              <div className="shop-card-right">
                <div className="shop-card-cost">
                  <Icon name="ph:coin-fill" size={14} color="#ffc86b" />
                  <span style={{ fontSize: 14, fontWeight: 800, color: '#ffc86b' }}>{item.cost}</span>
                </div>
                <button
                  className={`shop-buy-btn ${justBought ? 'bought' : ''}`}
                  disabled={!canBuy}
                  onClick={() => buy(item)}
                >
                  {justBought ? '✓' : owned >= ITEM_CAP ? t('shop.full', g.lang) : t('shop.buy', g.lang)}
                </button>
                <small style={{ color: 'var(--dim)', fontSize: 10 }}>
                  {owned}/{ITEM_CAP}
                </small>
              </div>
            </motion.div>
          )
        })}
      </div>

      <small className="center" style={{ marginTop: 8, color: 'var(--dim)' }}>
        {tf('shop.footer', g.lang, { n: ITEM_CAP })}
      </small>
    </div>
  )
}
