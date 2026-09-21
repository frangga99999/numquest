import React, { useEffect, useRef, useState } from 'react'
import './number-pad.css'

export default function NumberPad({ value, onChange, disabled = false, decimal = false, maxLength = 12 }) {
  const [tap, setTap] = useState(null)
  const [bouncing, setBouncing] = useState(false)
  const reset = useRef(null)
  useEffect(() => () => clearTimeout(reset.current), [])
  function press(key) {
    if (disabled) return
    setTap({ key, id: performance.now() })
    setBouncing(true)
    clearTimeout(reset.current)
    reset.current = setTimeout(() => setBouncing(false), 160)
    if (key === '⌫') onChange(value.slice(0, -1))
    else if (key === '±') onChange(value.startsWith('-') ? value.slice(1) : '-' + value)
    else if (key === 'C') onChange('')
    else if (value.length < maxLength && (key !== ',' || !/[.,]/.test(value))) onChange(value + key)
  }
  return <div className="number-pad" role="group" aria-label="Keyboard angka">
    <div className="number-pad-grid">{['1','2','3','4','5','6','7','8','9',decimal ? ',' : 'C','0','⌫',...(decimal ? ['±','C'] : [])].map(key => <button type="button" key={key} disabled={disabled} aria-label={key === '⌫' ? 'Hapus satu angka' : key === 'C' ? 'Hapus semua' : key === '±' ? 'Ubah tanda positif atau negatif' : key === ',' ? 'Koma desimal' : key} onClick={() => press(key)}>{key}</button>)}</div>
    <div className="number-pad-play" aria-hidden="true" data-bouncing={bouncing}><span className="number-pad-friend"><span>•ᴗ•</span></span><span className="number-pad-spark">{tap && /^\d$/.test(tap.key) ? tap.key : '✦'}</span></div>
  </div>
}
