import React from 'react'
import { MotionConfig } from 'framer-motion'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './design-system/tokens.css'
import './design-system/retro-ui.css'
import './design-system/numquest-theme.css'

// Bersihkan elemen suntikan (ekstensi browser, badge deploy, dll) di luar #root
new MutationObserver(() => {
  const root = document.getElementById('root')
  for (const el of [...document.body.children]) {
    if (el !== root && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && el.tagName !== 'LINK') {
      el.remove()
    }
  }
}).observe(document.body, { childList: true, subtree: false })

createRoot(document.getElementById('root')).render(<MotionConfig reducedMotion="user"><App /></MotionConfig>)
