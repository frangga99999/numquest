import React, { useEffect, useRef, useState } from 'react'
import { MODULES, SOURCES, PEDAGOGY, BANK_SIZE, makeSet, parseAnswer, validateRecipe } from './curriculum.js'
import { api } from './api.js'
import './academy.css'
import { Shape } from './design-system/RetroUI.jsx'

export default function Academy({ g, setG, onClose }) {
  const [track,setTrack]=useState('arithmetic'), [selected,setSelected]=useState(null)
  const [items,setItems]=useState([]), [index,setIndex]=useState(0), [input,setInput]=useState('')
  const [feedback,setFeedback]=useState(null), [correct,setCorrect]=useState(0), [finished,setFinished]=useState(false)
  const [timed,setTimed]=useState(false), [seconds,setSeconds]=useState(0), [busy,setBusy]=useState(false), [notice,setNotice]=useState('')
  const alive=useRef(true), answered=useRef(false)
  useEffect(()=>{alive.current=true;return()=>{alive.current=false}},[])
  const active=items.length>0&&!finished
  useEffect(()=>{if(!active||!timed)return; const timer=setInterval(()=>setSeconds(s=>Math.max(0,s-1)),1000);return()=>clearInterval(timer)},[active,timed])
  useEffect(()=>{if(active&&timed&&seconds===0) finish(correct,index+(feedback!==null?1:0))},[seconds,active,timed])
 const progress=g.academy || {}
  const bankEntries = MODULES.length * BANK_SIZE
  function finish(score,total) {
    setFinished(true)
    setG(s=>({...s,academy:{...s.academy,[selected.id]:{...s.academy?.[selected.id],best:Math.max(s.academy?.[selected.id]?.best||0,Math.round(score/items.length*100)),last:{correct:score,answered:total,total:items.length,date:new Date().toISOString()}}}}))
  }
  async function start(ai=false) {
    setBusy(true);setNotice('')
    let seed=progress[selected.id]?.cursor ?? Math.floor(Math.random()*BANK_SIZE)
    let next=makeSet(selected.id,seed)
    if(ai) {
      try {
        const result=await api.academy({module:selected.id,seed,recentSeeds:progress[selected.id]?.recentSeeds||[]})
        const validated=result.source==='ai'&&validateRecipe(result.recipe,selected.id)
        if(validated){next=validated;seed=result.recipe.seed;setNotice('AI memilih parameter dan variasi; jawaban dihitung ulang oleh mesin matematika.')}
        else setNotice('AI belum tersedia. Tantangan baru dibuat oleh generator lokal.')
      } catch { if(alive.current)setNotice('AI tidak terhubung. Tantangan baru dari generator lokal siap digunakan.') }
    }
    if(!alive.current)return
    setG(s=>({...s,academy:{...s.academy,[selected.id]:{...s.academy?.[selected.id],cursor:(seed+10)%BANK_SIZE,recentSeeds:[seed,...(s.academy?.[selected.id]?.recentSeeds||[]).filter(x=>x!==seed)].slice(0,8)}}}))
    setItems(next);setIndex(0);setInput('');setFeedback(null);setCorrect(0);setFinished(false);setSeconds(180);setBusy(false);answered.current=false
  }
  function check(e, value=input) {
    e.preventDefault()
    if(answered.current||!Number.isFinite(parseAnswer(value)))return
    answered.current=true
    const ok=Math.abs(parseAnswer(value)-items[index].answer)<0.005
    setFeedback(ok);if(ok)setCorrect(c=>c+1)
  }
  function next() {
    if(index+1===items.length){finish(correct,index+1);return}
    setIndex(i=>i+1);setInput('');setFeedback(null);answered.current=false
  }
  return <main className="academy screen pr-system">
    <div className="between"><span className="ac-eyebrow">NUMQUEST / AKADEMI</span><button className="pill" disabled={busy} onClick={onClose}>Tutup</button></div>
    <header className="ac-hero"><div className="ac-retro-art" aria-hidden="true"><Shape kind="clover"/><span>123</span></div><span className="ac-eyebrow">PAHAM DULU. LANCAR KEMUDIAN.</span><h1>Dari dasar,<br/>sampai mahir.</h1><p>Dua jalur belajar. Strategi yang bisa dipahami. Tantangan yang terus berganti.</p><div className="ac-tags"><span>{MODULES.length} modul bertahap</span><span>{bankEntries.toLocaleString('id-ID')} entri parametrik</span><span>6 format per modul</span><span>Pembahasan setiap soal</span></div></header>
    {!selected ? <>
      <div className="ac-tabs" role="tablist" aria-label="Jalur latihan">{[['arithmetic','Aritmatika'],['psychometric','Psikotes numerik']].map(([id,label])=><button role="tab" aria-selected={track===id} key={id} onClick={()=>setTrack(id)}>{label}</button>)}</div>
      <p>{track==='arithmetic'?'Bangun pemahaman, gunakan strategi mental, lalu terapkan pada persoalan bertingkat.':'Latih pola, ketelitian, data, dan laju kerja. Simulasi waktu opsional; bukan alat diagnosis atau tes psikologi resmi.'}</p>
      <div className="ac-modules">{MODULES.filter(m=>m.track===track).map((m,i)=><button className="ac-module" key={m.id} onClick={()=>{setSelected(m);setItems([]);setTimed(false);setNotice('')}}><span className="ac-number">{String(i+1).padStart(2,'0')}</span><span><small>{m.level} · {BANK_SIZE.toLocaleString('id-ID')} entri</small><strong>{m.title}</strong><small>{progress[m.id]?.last?`Ketepatan terbaik ${progress[m.id].best}%`:'Materi → contoh → 10 tantangan'}</small></span><span aria-hidden="true">↗</span></button>)}</div>
      <details className="ac-sources"><summary>Dasar penyusunan materi & sumber</summary><p>Materi orisinal NumQuest diinformasikan oleh prinsip pendidikan berikut; tidak berafiliasi atau disahkan oleh universitas. Adaptasi psikotes disusun terpisah dan bukan asesmen rekrutmen resmi.</p><ul>{PEDAGOGY.map(item=><li key={item}>{item}</li>)}</ul>{SOURCES.map(([name,desc,url])=><p key={name}><a href={url} target="_blank" rel="noreferrer">{name} ↗</a><br/>{desc}</p>)}</details>
    </> : <>
      <button className="btn ghost" disabled={busy} onClick={()=>{setSelected(null);setItems([]);setFinished(false)}}>← Kembali ke jalur belajar</button>
      <section className="ac-study"><span className="ac-eyebrow">{selected.level}</span><h2>{selected.title}</h2><p>{selected.lesson}</p><p className="ac-challenge-type">{selected.challenge}</p><div className="ac-example"><small>CONTOH TERURAI</small><p>{selected.example}</p></div></section>
      {notice&&<p role="status">{notice}</p>}
      {!items.length ? <section className="ac-study"><h2>Uji pemahamanmu</h2><p>10 soal, dengan pembahasan sebelum lanjut. Target anjuran: ketepatan 80% dalam dua sesi sebelum beralih modul.</p>{selected.track==='psychometric'&&<label className="ac-toggle"><input type="checkbox" checked={timed} onChange={e=>setTimed(e.target.checked)}/> Simulasi 3 menit (opsional)</label>}<div className="ac-actions"><button className="btn" disabled={busy} onClick={()=>start()}>Mulai latihan</button><button className="btn ghost" disabled={busy} onClick={()=>start(true)}>{busy?'Menyiapkan tantangan…':'Buat tantangan dengan AI ✦'}</button></div></section>
      : finished ? <section className="ac-study" aria-live="polite"><span className="ac-eyebrow">SESI SELESAI</span><h2>{correct} / {items.length} tepat</h2><p>{correct>=8?'Mantap. Ulangi dengan variasi baru untuk menguatkan strategi.':'Pelajari pembahasan dan coba kembali dengan ritmemu.'}</p>{items.map((q,i)=><details key={q.id}><summary>{i+1}. {q.text}</summary><p>{q.explanation} Jawaban: {q.answer.toLocaleString('id-ID')}.</p></details>)}<div className="ac-actions"><button className="btn" disabled={busy} onClick={()=>start()}>Latihan baru</button><button className="btn ghost" disabled={busy} onClick={()=>start(true)}>Variasi AI</button></div></section>
      : <section className="ac-study"><div className="between"><span>Soal {index+1} / {items.length}</span>{timed&&<span role="timer">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</span>}</div><progress value={index} max={items.length} aria-label="Kemajuan latihan"/><h2 className="ac-question">{items[index].text}</h2>{selected.track==='psychometric' && selected.id!=='p3' ? <div className="ac-options" aria-label="Pilihan jawaban">{[0,1,2,3].map(k=>{const offsets=[-2,-1,1]; const pos=items[index].seed%4; const value=k===pos?items[index].answer:Math.round((items[index].answer+offsets[k<pos?k:k-1])*100)/100;return <button className="opt" key={k} disabled={feedback!==null} onClick={e=>check(e,String(value))}>{String.fromCharCode(65+k)}. {value.toLocaleString('id-ID')}</button>})}</div> : <form onSubmit={check}><label htmlFor="academy-answer">Jawaban (gunakan koma untuk desimal)</label><input id="academy-answer" className="input" autoComplete="off" inputMode="text" value={input} disabled={feedback!==null} onChange={e=>setInput(e.target.value)} autoFocus key={index}/>{feedback===null&&<button className="btn" disabled={!Number.isFinite(parseAnswer(input))}>Periksa jawaban</button>}</form>}{feedback!==null&&<div role="status" className="ac-feedback"><strong>{feedback?'Tepat.':'Mari lihat strateginya.'}</strong><p>{items[index].explanation}</p><p>Jawaban: {items[index].answer.toLocaleString('id-ID')}</p><button className="btn" onClick={next}>{index+1===items.length?'Lihat hasil':'Soal berikutnya'}</button></div>}</section>}
    </>}
  </main>
}
