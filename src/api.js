// Klien API. Semua rute butuh token kecuali daftar/masuk dan peta dunia.
// Aplikasi tetap jalan penuh tanpa server — pemanggil menangkap galat dan
// jatuh ke mesin lokal + localStorage.

const BASE = import.meta.env?.VITE_API || 'http://localhost:8787/api'
const TKEY = 'numquest.token'
// modul ini ikut terbaca oleh test di Node — di sana tidak ada localStorage
const store = typeof localStorage !== 'undefined' ? localStorage : { getItem: () => null, setItem: () => {}, removeItem: () => {} }

let token = store.getItem(TKEY) || null
export const loggedIn = () => !!token

// Cek koneksi ke server AI — dipakai UI buat indikator status
let _aiOnline = null
export async function checkAiOnline() {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 4000)
    const res = await fetch(BASE + '/lessons?level=easy&lang=id', { signal: ctrl.signal })
    clearTimeout(t)
    const data = await res.json().catch(() => ({}))
    _aiOnline = data.aiReady === true
  } catch { _aiOnline = false }
  return _aiOnline
}
export const aiOnline = () => _aiOnline

export function setToken(t) {
  token = t || null
  if (t) store.setItem(TKEY, t)
  else store.removeItem(TKEY)
}

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401) setToken(null)
    throw new Error(data.error || `Gangguan jaringan (${res.status})`)
  }
  return data
}

export const api = {
  register: async (b) => { const r = await call('POST', '/auth/register', b); setToken(r.token); return r },
  login: async (b) => { const r = await call('POST', '/auth/login', b); setToken(r.token); return r },
  logout: () => setToken(null),

  getState: () => call('GET', '/state'),
  putState: (state) => call('PUT', '/state', { state }),

  coach: () => call('GET', '/coach'),
  quests: () => call('GET', '/quests'),
  challenge: () => call('GET', '/challenge'),
  flavorProblems: (problems) => call('POST', '/problem/flavor', { problems }),
  explainProblem: (problem) => call('POST', '/problem/explain', { problem }),
  challengeProblems: (opts) => call('POST', '/problem/challenge', opts),

  league: () => call('GET', '/league'),
  world: () => call('GET', '/world'),

  clans: (q = '') => call('GET', `/clans?q=${encodeURIComponent(q)}`),
  createClan: (b) => call('POST', '/clans', b),
  joinClan: (clanId) => call('POST', '/clans/join', { clanId }),
  leaveClan: () => call('POST', '/clans/leave'),
  clan: () => call('GET', '/clan'),
  chat: (body) => call('POST', '/clan/chat', { body }),
  setChallenge: (b) => call('POST', '/clan/challenge', b),
  warSession: (stars) => call('POST', '/war/session', { stars }),
  lessons: (level, lang, refresh) => call('GET', `/lessons?level=${encodeURIComponent(level || 'easy')}&lang=${lang || 'id'}${refresh ? '&refresh=1' : ''}`),
  learnChat: (message, topic, history, lang) => call('POST', '/learn/chat', { message, topic, history, lang }),
}
