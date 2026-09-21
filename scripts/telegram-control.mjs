import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const exec = promisify(execFile)
const token = process.env.TELEGRAM_BOT_TOKEN
const owner = process.env.TELEGRAM_OWNER_ID
const repo = process.env.NUMQUEST_REPO
const dev = process.env.NUMQUEST_DEV_REPO
const cursorFile = process.env.TELEGRAM_CURSOR_FILE
if (!token || !/^\d+$/.test(owner || '') || !repo || !dev || !cursorFile || resolve(repo) === resolve(dev)) throw new Error('Configure token, owner ID, separate production/development repos, and cursor file.')
const started = Math.floor(Date.now()/1000)
const childEnv = { ...process.env }
delete childEnv.TELEGRAM_BOT_TOKEN
delete childEnv.AI_KEY
delete childEnv.AUTH_SECRET
const run = (command, args, cwd = repo) => exec(command,args,{cwd,env:childEnv,timeout:900000,maxBuffer:1024*1024})
async function api(method, body) {
  const response = await fetch('https://api.telegram.org/bot'+token+'/'+method,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(45000)})
  const data = await response.json()
  if (!response.ok || !data.ok) throw new Error('Telegram request failed')
  return data.result
}
const say = text => api('sendMessage',{chat_id:owner,text:text.slice(0,3800)})
let offset = 0
try { offset = Number(await readFile(cursorFile,'utf8')) || 0 } catch (error) { if (error.code !== 'ENOENT') throw error }
while (true) {
  try {
    const updates = await api('getUpdates',{offset,timeout:30,allowed_updates:['message']})
    for (const update of updates) {
      offset = update.update_id+1
      // Acknowledge before commands: restarts never replay deployment requests.
      await writeFile(cursorFile,String(offset),{mode:0o600})
      const m = update.message
      if (!m || String(m.from?.id)!==owner || String(m.chat?.id)!==owner || m.chat.type!=='private' || m.date<started || typeof m.text!=='string') continue
      const [command,...words] = m.text.trim().split(/\s+/)
      try {
        if (command === '/status') {
          const status = await run('systemctl',['--user','is-active','numquest.service'])
          const commit = await run('git',['log','-1','--format=%h %s'])
          await say(status.stdout.trim()+' · '+commit.stdout.trim())
        } else if (command === '/restart') {
          await run('systemctl',['--user','restart','numquest.service']); await say('Service dimulai ulang.')
        } else if (command === '/deploy') {
          await say('Menarik commit yang sudah dipush dan membangun produksi…')
          await run('bash',['scripts/deploy-vps.sh']); await say('Deploy VPS selesai dan health check lulus.')
        } else if (command === '/develop' && words.length) {
          await say('Mengembangkan di checkout terpisah. Produksi tetap memakai build terakhir.')
          await run('codex',['exec','--sandbox','workspace-write','--color','never','--', 'Kerjakan perubahan berikut di checkout development ini. Jangan deploy, push, atau membaca kredensial. Jalankan pemeriksaan relevan dan biarkan perubahan untuk direview. Permintaan: '+words.join(' ').slice(0,6000)],dev)
          const result = await run('git',['status','--short'],dev)
          await say('Proses development selesai. Review file di checkout development sebelum commit/push:\n'+(result.stdout || 'Tidak ada perubahan file.'))
        } else if (command === '/changes') {
          const result = await run('git',['status','--short'],dev); await say(result.stdout || 'Checkout development bersih.')
        } else if (command === '/check') {
          await run('npm',['test'],dev); await run('npm',['run','build'],dev); await say('Test dan build development lulus.')
        } else await say('/status · /restart · /deploy · /changes · /check\n/develop <permintaan perubahan>\nReview dan commit/push perubahan development lewat SSH sebelum /deploy.')
      } catch { await say('Perintah tidak selesai. Periksa journal VPS; log mentah tidak dikirim untuk menjaga kredensial.') }
    }
  } catch { console.error('Telegram polling failed; retrying.'); await new Promise(r=>setTimeout(r,5000)) }
}
