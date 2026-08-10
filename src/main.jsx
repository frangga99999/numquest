import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

// Bersihkan elemen suntikan (ekstensi browser, badge deploy, dll) di luar #root
new MutationObserver(() => {
  const root = document.getElementById('root')
  for (const el of [...document.body.children]) {
    if (el !== root && el.tagName !== 'SCRIPT' && el.tagName !== 'STYLE' && el.tagName !== 'LINK') {
      el.remove()
    }
  }
}).observe(document.body, { childList: true, subtree: false })

createRoot(document.getElementById('root')).render(<App />)
