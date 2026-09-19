import test from 'node:test'
import assert from 'node:assert/strict'
import {MODULES, BANK_SIZE, question, makeSet, validateRecipe, parseAnswer} from './curriculum.js'
import {generateAcademy} from '../server/academy.js'

test('all 1.2 million bank entries are finite, reproducible and explained',()=>{
  assert.equal(MODULES.length,24)
  assert.equal(MODULES.filter(m=>m.track==='arithmetic').length,12)
  assert.equal(MODULES.filter(m=>m.track==='psychometric').length,12)
  for(const module of MODULES) for(let seed=0;seed<BANK_SIZE;seed++) {
    const q=question(module.id,seed)
    assert.ok(Number.isFinite(q.answer),q.id)
    assert.ok(q.text.length>5&&q.explanation.length>10,q.id)
    assert.deepEqual(question(module.id,seed),q)
  }
})
test('arithmetic and reasoning answers follow independent identities',()=>{
  for(let seed=0;seed<10000;seed+=37){
    const a=2+seed%100,b=2+Math.floor(seed/100),d=2+seed%7
    assert.equal(question('a1',seed,0).answer,a+b)
    assert.equal(question('a1',seed,1).answer,b)
    assert.equal(question('a2',seed,0).answer,a*b)
    assert.equal(question('a3',seed).answer,b-a)
    assert.equal(question('a4',seed).answer,Math.round((a/d+b/d)*100+1e-8)/100)
    assert.equal(question('a5',seed).answer,a*b)
    assert.equal(question('a6',seed).answer,(a+b)*d-b)
    assert.equal(question('a7',seed).answer,a**2+b)
    assert.equal(question('a8',seed).answer,Math.round(a*10000*(1+b/100)*.9))
    assert.equal(question('p1',seed).answer,a+4*b)
    assert.equal(question('p2',seed).answer,b*d)
    assert.equal(question('p4',seed).answer,a+3*d)
    assert.equal(question('p5',seed).answer,d*(a+b))
    assert.equal(question('p6',seed).answer,Math.round((a+b+a+b)/3*100)/100)
    assert.equal(question('p7',seed).answer,a+b+(b+2)+(b+4)+(b+6))
    assert.equal(question('p8',seed).answer,Math.round(1/(1/a+1/b)*100+1e-8)/100)
  }
})
test('batches wrap, advance without repeat IDs, and invalid AI output is rejected',()=>{
 const first=makeSet('a1',9995),second=makeSet('a1',5)
 assert.equal(new Set([...first,...second].map(q=>q.id)).size,20)
 for(const bad of [null,{}, {seed:-1,variants:Array(10).fill(0)},{seed:2,variants:[9]},{seed:2,variants:Array(10).fill(6)}]) assert.equal(validateRecipe(bad,'a1'),null)
 assert.equal(validateRecipe({seed:1,variants:Array(10).fill(1)},'a1').length,10)
 assert.ok(Number.isNaN(parseAnswer('')));assert.ok(Number.isNaN(parseAnswer('2x')))
 assert.equal(parseAnswer('-1,25'),-1.25)
})
test('AI integration validates model output and handles failure without leaking credentials',async()=>{
 const old=process.env.AI_KEY;process.env.AI_KEY='test-only'
 try{
   const good=async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({seed:7,variants:Array(10).fill(2)})}}]})})
   const result=await generateAcademy({module:'p1',seed:7},good)
   assert.equal(result.source,'ai');assert.equal(result.recipe.seed,17)
   assert.deepEqual(await generateAcademy({module:'p1'},async()=>{throw new Error('offline')}),{source:'local'})
   assert.deepEqual(await generateAcademy({module:'p1'},async()=>({ok:true,json:async()=>({choices:[{message:{content:'{}'}}]})})),{source:'local'})
 }finally{if(old===undefined)delete process.env.AI_KEY;else process.env.AI_KEY=old}
})
