import React, { useEffect, useRef } from 'react'

export default function GuideDialog({ children, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    const dialog = ref.current
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialog.showModal()
    return () => { dialog.close(); document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus?.() }
  }, [])
  return <dialog ref={ref} className="fn-guide-dialog" aria-label="Panduan tantangan" onCancel={e => { e.preventDefault(); onClose() }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="fn-guide-toolbar"><span>Panduan singkat</span><button type="button" className="fn-text-button" onClick={onClose} autoFocus aria-label="Tutup panduan">Tutup ×</button></div>
    <div className="fn-guide-content">{children}<button type="button" className="fn-text-button" onClick={onClose}>Lewati panduan</button></div>
  </dialog>
}
