import type { SessionResult } from '../types'

// Local-first persistence: sessions + plan live in localStorage. No backend,
// no accounts, no API cost — which is also the monetization advantage (near-
// zero marginal cost per user). This is what turns the app from a one-shot
// mirror into a coach that tracks improvement over time.

const SESSIONS_KEY = 'guru.sessions.v2'
const PRO_KEY = 'guru.pro.v1'

export const FREE_SESSION_LIMIT = 3

export type Layer = 'Delivery' | 'Arrangement' | 'Style' | 'Invention'

export interface StoredSession {
  id: string
  date: number
  prompt: string
  deliveryScore: number
  arrangementScore: number
  styleScore: number
  inventionScore: number
  weakestLayer: Layer
  technique: string
  wpm: number
  fillerCount: number
}

export function toStored(prompt: string, r: SessionResult): StoredSession {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: Date.now(),
    prompt,
    deliveryScore: r.delivery.score,
    arrangementScore: r.arrangement.score,
    styleScore: r.style.score,
    inventionScore: r.invention.score,
    weakestLayer: r.coach.weakestLayer,
    technique: r.coach.technique,
    wpm: r.delivery.wpm,
    fillerCount: r.delivery.fillerCount,
  }
}

export function loadSessions(): StoredSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as StoredSession[]
    return Array.isArray(arr) ? arr.sort((a, b) => a.date - b.date) : []
  } catch {
    return []
  }
}

export function saveSession(s: StoredSession): StoredSession[] {
  const all = [...loadSessions(), s]
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(all))
  return all
}

export function clearSessions() {
  localStorage.removeItem(SESSIONS_KEY)
}

// ---- Plan / gating ----------------------------------------------------
export function isPro(): boolean {
  return localStorage.getItem(PRO_KEY) === '1'
}
export function setPro(on: boolean) {
  if (on) localStorage.setItem(PRO_KEY, '1')
  else localStorage.removeItem(PRO_KEY)
}
export function canStartSession(count: number): boolean {
  return isPro() || count < FREE_SESSION_LIMIT
}
export function sessionsLeft(count: number): number {
  return isPro() ? Infinity : Math.max(0, FREE_SESSION_LIMIT - count)
}

// ---- Progress analytics ----------------------------------------------
interface LayerProgress {
  latest: number
  first: number
  delta: number
  series: number[]
}

export interface Progress {
  total: number
  streakDays: number
  delivery: LayerProgress
  arrangement: LayerProgress
  style: LayerProgress
  invention: LayerProgress
  focusLayer: Layer | null
  focusCount: number
  bestScore: number
}

function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function streak(sessions: StoredSession[]): number {
  if (!sessions.length) return 0
  const days = new Set(sessions.map((s) => dayKey(s.date)))
  let count = 0
  const cur = new Date()
  // Allow the streak to count from today or yesterday.
  if (!days.has(dayKey(cur.getTime()))) cur.setDate(cur.getDate() - 1)
  while (days.has(dayKey(cur.getTime()))) {
    count++
    cur.setDate(cur.getDate() - 1)
  }
  return count
}

export function computeProgress(sessions: StoredSession[]): Progress {
  const layer = (arr: number[]) => ({
    latest: arr.at(-1) ?? 0,
    first: arr[0] ?? 0,
    delta: (arr.at(-1) ?? 0) - (arr[0] ?? 0),
    series: arr.slice(-12),
  })
  const counts: Record<Layer, number> = { Delivery: 0, Arrangement: 0, Style: 0, Invention: 0 }
  for (const s of sessions) counts[s.weakestLayer]++
  // The layer that has been weakest most often is the user's recurring focus.
  const focusLayer =
    sessions.length === 0
      ? null
      : (['Delivery', 'Arrangement', 'Style', 'Invention'] as Layer[]).reduce((a, b) =>
          counts[b] > counts[a] ? b : a,
        )
  return {
    total: sessions.length,
    streakDays: streak(sessions),
    delivery: layer(sessions.map((s) => s.deliveryScore)),
    arrangement: layer(sessions.map((s) => s.arrangementScore)),
    style: layer(sessions.map((s) => s.styleScore)),
    invention: layer(sessions.map((s) => s.inventionScore ?? 0)),
    focusLayer,
    focusCount: focusLayer ? counts[focusLayer] : 0,
    bestScore: sessions.reduce(
      (m, s) => Math.max(m, s.deliveryScore, s.arrangementScore, s.styleScore, s.inventionScore ?? 0),
      0,
    ),
  }
}
