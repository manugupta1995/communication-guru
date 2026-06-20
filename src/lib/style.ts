import type { StyleResult } from '../types'

// Style canon (Layer 3): language quality — concision, jargon, concreteness.
// Deterministic, in-browser. Robust to unpunctuated speech transcripts.

const JARGON = [
  'synergy', 'leverage', 'circle back', 'bandwidth', 'holistic', 'paradigm',
  'robust', 'scalable', 'streamline', 'low-hanging fruit', 'move the needle',
  'deep dive', 'touch base', 'value add', 'core competency', 'best in class',
  'going forward', 'at the end of the day', 'think outside the box', 'ecosystem',
  'mission critical', 'boil the ocean', 'drill down', 'actionable', 'ideate',
]

const VAGUE = [
  'thing', 'things', 'stuff', 'various', 'several', 'some', 'a lot', 'lots',
  'really', 'very', 'quite', 'somewhat', 'kind of', 'sort of', 'whatever',
  'etc', 'and so on', 'or something', 'a bit', 'pretty much', 'a few',
]

// Strong clause-joiners — many of these per 100 words signals run-on sentences.
const CONNECTORS = /\b(and|but|so|then|because|which|that|also|plus)\b/gi

function words(t: string): string[] {
  return t.toLowerCase().match(/\b[\w']+\b/g) ?? []
}

function countPhrases(text: string, phrases: string[]): { count: number; hits: string[] } {
  const hits: Record<string, number> = {}
  let count = 0
  for (const p of phrases) {
    const re = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
    const m = text.match(re)
    if (m) {
      hits[p] = m.length
      count += m.length
    }
  }
  const ordered = Object.entries(hits).sort((a, b) => b[1] - a[1]).map(([k]) => k)
  return { count, hits: ordered }
}

// Average sentence length. Uses punctuation when present; otherwise estimates
// from clause-joiner density (speech transcripts often lack punctuation).
function avgSentenceLength(text: string, n: number): number {
  const terminals = (text.match(/[.!?]+/g) || []).length
  if (terminals >= 2) return Math.round(n / terminals)
  const joiners = (text.match(CONNECTORS) || []).length
  return Math.round(n / Math.max(1, joiners + 1))
}

function concisionScore(avgLen: number): number {
  // Sweet spot ~8-18 words; long run-ons read as unclear.
  if (avgLen <= 18 && avgLen >= 6) return 100
  if (avgLen < 6) return 80 // very choppy
  return Math.max(25, Math.round(100 - (avgLen - 18) * 5))
}

function jargonScore(rate: number): number {
  // rate = jargon per 100 words.
  if (rate === 0) return 100
  return Math.max(30, Math.round(100 - rate * 22))
}

export function scoreStyle(transcript: string): StyleResult {
  const text = transcript.toLowerCase()
  const w = words(text)
  const n = w.length || 1

  const jargon = countPhrases(text, JARGON)
  const vague = countPhrases(text, VAGUE)
  const numbers = (text.match(/\b\d+(\.\d+)?%?\b/g) || []).length

  const avgLen = avgSentenceLength(text, n)
  const jargonRate = (jargon.count / n) * 100
  const vagueRate = (vague.count / n) * 100

  const concreteness = Math.max(
    15,
    Math.min(100, Math.round(58 + Math.min(30, numbers * 9) - Math.min(45, vagueRate * 6))),
  )

  const sub = {
    concision: concisionScore(avgLen),
    jargon: jargonScore(jargonRate),
    concreteness,
  }
  const score = Math.round(sub.concision * 0.34 + sub.jargon * 0.3 + sub.concreteness * 0.36)

  return {
    score,
    avgSentenceLen: avgLen,
    jargonCount: jargon.count,
    jargonWords: jargon.hits,
    concreteness,
    vagueCount: vague.count,
    subScores: sub,
  }
}
