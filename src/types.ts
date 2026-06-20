// Shared types for the Great Speaker Stack (V1: Delivery + Arrangement)

export interface Situation {
  audience: string
  occasion: string
  purpose: string
}

// Deterministic, computed in-browser from audio + transcript.
export interface DeliveryMetrics {
  durationSec: number
  wordCount: number
  wpm: number
  fillerCount: number
  fillerRate: number // fillers / words
  fillerWords: string[] // which ones, for evidence
  pauseCount: number // silent gaps > 0.4s
  vocalVariety: number // coefficient of variation of energy, 0..1+
  score: number // 0..100
  subScores: {
    pace: number
    fillers: number
    variety: number
  }
}

// Style canon — language quality, computed in-browser.
export interface StyleResult {
  score: number
  avgSentenceLen: number
  jargonCount: number
  jargonWords: string[]
  concreteness: number
  vagueCount: number
  subScores: {
    concision: number
    jargon: number
    concreteness: number
  }
}

// Judged by Claude on the server.
export interface ArrangementResult {
  score: number // 0..100
  hasHook: boolean
  hasClose: boolean
  structure: string // e.g. "STAR", "problem-solution", "rambling"
  signposting: 'strong' | 'some' | 'weak'
  evidence: string
  feedback: string
  source: 'heuristic' | 'claude'
}

export interface CoachCard {
  weakestLayer: 'Delivery' | 'Arrangement' | 'Style'
  technique: string
  why: string
  drill: string
  evidence: string
  encouragement: string
}

export interface SessionResult {
  situation: Situation
  transcript: string
  delivery: DeliveryMetrics
  arrangement: ArrangementResult
  style: StyleResult
  coach: CoachCard
}
