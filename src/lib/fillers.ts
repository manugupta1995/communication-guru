// Filler-word detection. Order matters: multi-word fillers first.
const FILLER_PATTERNS: { label: string; re: RegExp }[] = [
  { label: 'you know', re: /\byou know\b/gi },
  { label: 'i mean', re: /\bi mean\b/gi },
  { label: 'sort of', re: /\bsort of\b/gi },
  { label: 'kind of', re: /\bkind of\b/gi },
  { label: 'um', re: /\bu+m+\b/gi },
  { label: 'uh', re: /\bu+h+\b/gi },
  { label: 'er', re: /\be+r+\b/gi },
  { label: 'like', re: /\blike\b/gi },
  { label: 'basically', re: /\bbasically\b/gi },
  { label: 'actually', re: /\bactually\b/gi },
  { label: 'literally', re: /\bliterally\b/gi },
  { label: 'so', re: /\bso\b/gi }, // counted but weighted lightly in practice
  { label: 'right', re: /\bright\b/gi },
]

export interface FillerResult {
  count: number
  words: string[] // distinct labels found, most frequent first
  breakdown: { label: string; n: number }[] // per-word counts
}

export function countFillers(transcript: string): FillerResult {
  const found: Record<string, number> = {}
  let total = 0
  for (const { label, re } of FILLER_PATTERNS) {
    const matches = transcript.match(re)
    if (matches && matches.length) {
      found[label] = matches.length
      total += matches.length
    }
  }
  const breakdown = Object.entries(found)
    .sort((a, b) => b[1] - a[1])
    .map(([label, n]) => ({ label, n }))
  return { count: total, words: breakdown.map((b) => b.label), breakdown }
}

export function wordCount(transcript: string): number {
  const w = transcript.trim().match(/\b[\w']+\b/g)
  return w ? w.length : 0
}
