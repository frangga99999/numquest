// Efek suara sintetis via Web Audio + file mission mp3.
let ctx = null
const getCtx = () => {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

let muted = false
export const setMuted = (v) => { muted = v }

function tone(freq, { at = 0, dur = 0.12, type = 'sine', gain = 0.18, slideTo } = {}) {
  const c = getCtx()
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, c.currentTime + at)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + at + dur)
  g.gain.setValueAtTime(0, c.currentTime + at)
  g.gain.linearRampToValueAtTime(gain, c.currentTime + at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + at + dur)
  osc.connect(g).connect(c.destination)
  osc.start(c.currentTime + at)
  osc.stop(c.currentTime + at + dur + 0.02)
}

const play = (fn) => { if (!muted) { try { fn() } catch { /* audio blocked pre-gesture */ } } }

// Cache buffer hasil decode — decode cuma sekali, pakai berkali-kali.
const bufferCache = {}
function playFile(url, vol = 0.7) {
  if (muted) return
  const c = getCtx()
  const playBuf = (buf) => {
    const src = c.createBufferSource()
    const g = c.createGain()
    src.buffer = buf
    g.gain.value = vol
    src.connect(g).connect(c.destination)
    src.start()
  }
  if (bufferCache[url]) return playBuf(bufferCache[url])
  fetch(url).then((r) => r.arrayBuffer())
    .then((ab) => c.decodeAudioData(ab))
    .then((buf) => { bufferCache[url] = buf; playBuf(buf) })
    .catch(() => { /* file missing — silent fallback */ })
}

export const sfx = {
  tap: () => play(() => tone(520, { dur: 0.05, gain: 0.1 })),
  correct: () => play(() => { tone(660, { dur: 0.1 }); tone(880, { at: 0.08, dur: 0.16 }) }),
  wrong: () => play(() => tone(180, { dur: 0.25, type: 'sawtooth', gain: 0.14, slideTo: 110 })),
  coin: () => play(() => { tone(988, { dur: 0.08, gain: 0.14 }); tone(1318, { at: 0.06, dur: 0.14, gain: 0.14 }) }),
  levelup: () => play(() => {
    ;[523, 659, 784, 1047].forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.22, gain: 0.16 }))
  }),
  heartLoss: () => play(() => tone(140, { dur: 0.3, type: 'triangle', gain: 0.15, slideTo: 90 })),
  missionSuccess: () => playFile('/assets/Mission_Success.mp3', 0.65),
  missionFailed: () => playFile('/assets/Mission_Failed.mp3', 0.65),
}
