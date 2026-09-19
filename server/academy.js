import { MODULES, validateRecipe } from '../src/curriculum.js'

export async function generateAcademy(body, request = fetch) {
  const module = MODULES.find(m=>m.id===body?.module)
  if(!module) throw new Error('Modul tidak dikenal')
  if(!process.env.AI_KEY) return {source:'local'}
  const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),10000)
  try {
    const res=await request(`${process.env.AI_BASE || 'https://api.openai.com/v1'}/chat/completions`,{
      method:'POST',signal:ctrl.signal,
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.AI_KEY}`},
      body:JSON.stringify({model:process.env.AI_MODEL || 'gpt-4o-mini',temperature:0.9,max_tokens:250,response_format:{type:'json_object'},messages:[
        {role:'system',content:'Susun resep tantangan numerik yang berbeda dari sesi terbaru. Pilih seed integer 0..49999 yang tidak ada di recentSeeds dan 10 variants integer 0..5. Campurkan sedikitnya 3 format berbeda; jangan semua variants sama. Mesin deterministik menghitung soal, jawaban, dan pembahasan. Balas hanya JSON {"seed":123,"variants":[0,1,2,3,4,5,0,2,4,1]}.'},
        {role:'user',content:JSON.stringify({module:module.title,level:module.level,track:module.track,previousSeed:Number.isInteger(body.seed)?body.seed:0,recentSeeds:Array.isArray(body.recentSeeds)?body.recentSeeds.slice(0,8):[]})},
      ]}),
    })
    if(!res.ok) return {source:'local'}
    const data=await res.json(), recipe=JSON.parse(data.choices?.[0]?.message?.content || '{}')
    if(!validateRecipe(recipe,module.id)) return {source:'local'}
    // Model dapat mengulang seed; tetap pilih resep baru yang tervalidasi.
    const recent=new Set([body.seed,...(Array.isArray(body.recentSeeds)?body.recentSeeds:[])].filter(Number.isInteger))
    while(recent.has(recipe.seed)) recipe.seed=(recipe.seed+10)%50000
    if(new Set(recipe.variants).size<3) recipe.variants=recipe.variants.map((_,i)=>i%6)
    return {source:'ai',recipe}
  } catch {return {source:'local'}} finally {clearTimeout(timer)}
}
