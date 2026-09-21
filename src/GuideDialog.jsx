import React, { useEffect, useRef } from 'react'

export default function GuideDialog({ children, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    ref.current.showModal()
    return () => { ref.current?.close(); previous?.focus?.() }
  }, [])
  return <dialog ref={ref} className="fn-guide-dialog" aria-label="Panduan tantangan" onCancel={e => { e.preventDefault(); onClose() }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="fn-guide-content"><button type="button" className="fn-text-button" onClick={onClose} autoFocus>Tutup panduan · Langsung latihan ×</button>{children}<button type="button" className="fn-text-button" onClick={onClose}>Lewati panduan</button></div>
  </dialog>
}
