import React, { useEffect, useRef, useId } from 'react'

export function Shape({ kind='clover', className='', ...props }) {
  return <svg viewBox="0 0 100 100" className={`pr-shape ${className}`} aria-hidden="true" focusable="false" {...props}>
    {kind==='clover'?<path d="M50 50C-8 58-5-7 29 4C51 10 50 38 50 50C42-8 107-5 96 29C90 51 62 50 50 50C108 42 105 107 71 96C49 90 50 62 50 50C58 108-7 105 4 71C10 49 38 50 50 50Z"/>:kind==='spark'?<path d="M50 0Q57 43 100 50Q57 57 50 100Q43 57 0 50Q43 43 50 0Z"/>:kind==='arch'?<path d="M5 100V45a45 45 0 0 1 90 0v55Z"/>:<circle cx="50" cy="50" r="48"/>}
  </svg>
}
export function Button({variant='primary',size='md',loading=false,expression='playful',children,className='',disabled,...props}) {
 return <button {...props} disabled={disabled||loading} aria-busy={loading||undefined} className={`pr-button pr-button--${variant} pr-button--${size} ${className}`} data-expression={expression}>{loading&&<span className="pr-spinner" aria-hidden="true"/>}{children}</button>
}
export function Badge({children,tone='neutral'}) {return <span className="pr-badge" data-tone={tone}>{children}</span>}
export function GameCard({as:Tag='section',eyebrow,title,description,media,badge,children,footer,tone='cream',expression='playful',className='',...props}) {
 return <Tag {...props} className={`pr-card ${className}`} data-tone={tone} data-expression={expression}>{media&&<div className="pr-card-media">{media}</div>}<div className="pr-card-top">{eyebrow&&<span className="pr-eyebrow">{eyebrow}</span>}{badge}</div>{title&&<h2>{title}</h2>}{description&&<p>{description}</p>}{children}{footer&&<div className="pr-card-footer">{footer}</div>}</Tag>
}
export function Progress({value=0,max=100,label='Progres'}) {const n=Math.max(0,Math.min(max,value));return <div className="pr-progress" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={n}><span style={{transform:`scaleX(${max>0?n/max:0})`}}/></div>}
export function Resource({symbol='★',value,label}) {return <span className="pr-resource"><span aria-hidden="true">{symbol}</span><strong>{value}</strong><small>{label}</small></span>}
export function Segmented({options,value,onChange,label='Pilihan'}) {return <div className="pr-segmented" role="group" aria-label={label}>{options.map(o=><button key={o.value} aria-pressed={value===o.value} onClick={()=>onChange(o.value)}>{o.label}</button>)}</div>}
export function Field({label,error,id,...props}) {return <label className="pr-field" htmlFor={id}><span>{label}</span><input id={id} aria-invalid={!!error} aria-describedby={error?`${id}-error`:undefined} {...props}/>{error&&<small id={`${id}-error`}>! {error}</small>}</label>}
export function Toggle({label,checked,onChange}) {return <label className="pr-toggle"><span>{label}</span><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/><span className="pr-toggle-track" aria-hidden="true"/></label>}
export function Dialog({open,onClose,title,children}) {
 const ref=useRef(null), titleId=useId()
 useEffect(()=>{if(open&&!ref.current.open)ref.current.showModal();else if(!open&&ref.current.open)ref.current.close()},[open])
 return <dialog className="pr-dialog" ref={ref} onCancel={onClose} onClose={onClose} aria-labelledby={titleId}><div className="pr-dialog-heading"><h2 id={titleId}>{title}</h2><Button variant="tertiary" aria-label="Tutup dialog" onClick={onClose}>×</Button></div>{children}</dialog>
}
