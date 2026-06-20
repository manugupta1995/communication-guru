import type { InventionResult } from '../types'

// Invention canon (Layer 4): SUBSTANCE — is there a real point backed by
// specific evidence, or is it polished but empty? This is the axis that
// separates "I hit my targets most quarters" from "I grew revenue 2M→10M".
// Heuristic + in-browser (an LLM would judge this best; this catches the
// clear signal: specificity, evidence, impact vs generic filler).

// Generic, say-nothing phrases that signal hand-waving over substance.
const GENERIC = [
  'various', 'stuff', 'things', 'a few', 'a bit', 'good at', 'pretty good',
  'i like', 'i enjoy', 'i work with', 'help teams', 'make decisions', 'i handle',
  'most quarters', 'do stuff', 'a person', 'somewhere', 'for a while', 'a lot of',
  'and stuff', 'or something', 'kind of work', 'some years', 'i do things',
]

// Outcome/impact verbs — substance shows up as things that happened.
const IMPACT = /\b(grew|increased|reduced|cut|saved|launched|shipped|doubled|tripled|drove|raised|boosted|delivered|scaled|rebuilt|lifted|took over|rewrote)\b/g

// Quantified evidence: digits AND spelled-out magnitudes ("two million",
// "in half"), percents, multipliers.
const QUANT_DIGITS = /\b\d[\d,.]*\b/g
const QUANT_WORDS = /\b(millions?|thousands?|billions?|hundreds?|percent|half|doubled?|tripled?|quadrupled?)\b/g

// A real thesis: "a <role> WHO <does something that matters>".
const THESIS = /(who|that)\s+(builds?|turns?|ships?|grows?|finds?|makes?|cuts?|leads?|drives?|solves?|helps?|turn|fixes?|delivers?)/

function words(t: string): string[] {
  return t.toLowerCase().match(/\b[\w']+\b/g) ?? []
}

function countMatches(text: string, re: RegExp): number {
  return (text.match(re) || []).length
}

function countGeneric(text: string): { count: number; hits: string[] } {
  const hits: string[] = []
  let count = 0
  for (const p of GENERIC) {
    const re = new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g')
    const m = text.match(re)
    if (m) {
      count += m.length
      hits.push(p)
    }
  }
  return { count, hits }
}

export function scoreInvention(transcript: string): InventionResult {
  const text = transcript.toLowerCase()
  const w = words(text)
  const n = w.length || 1

  const quantCount = countMatches(text, QUANT_DIGITS) + countMatches(text, QUANT_WORDS)
  const impactCount = countMatches(text, IMPACT)
  const generic = countGeneric(text)
  const hasThesis = THESIS.test(text.slice(0, 160))

  // Evidence: quantified facts + concrete outcomes.
  const evidence = Math.min(100, 38 + quantCount * 14 + impactCount * 11)
  // Genericness drags it down.
  const genericRate = (generic.count / n) * 100
  const genericPenalty = Math.min(35, Math.round(genericRate * 6))
  const thesisBonus = hasThesis ? 12 : 0

  const score = Math.max(8, Math.min(100, evidence - genericPenalty + thesisBonus))

  const sub = {
    evidence: Math.round(evidence),
    specificity: Math.max(8, Math.min(100, 100 - genericPenalty * 2)),
    point: hasThesis ? 100 : 45,
  }

  return {
    score,
    quantCount,
    impactCount,
    genericCount: generic.count,
    genericWords: generic.hits,
    hasThesis,
    subScores: sub,
  }
}
