import type { ArrangementResult, Situation } from '../types'

// Heuristic Arrangement scorer — pure TypeScript, runs in-browser, no LLM.
// Scores STRUCTURE only (the Arrangement canon): does it open with a point,
// is it ordered/signposted, does it close strongly, or does it ramble?
//
// Designed to survive UNPUNCTUATED transcripts (webkitSpeechRecognition often
// returns none), so it relies on keyword markers + position windows + length,
// not sentence parsing.

const FILLER_OPEN = /^(so|yeah|um+|uh+|er+|basically|i mean|well|ok|okay|like)\b/

// Opening that leads with the point (BLUF) or a numbered preview.
const HOOK_PATTERNS = [
  /^(the (short|key|main|quick) (version|point|thing|answer))/,
  /^(my (answer|approach|take|short answer))/,
  /^(here'?s (what|how|the))/,
  /^(there (were|are|was) (a |an )?(two|three|four|five|\d|couple|few))/,
  /^(short version)/,
  /^(bottom line)/,
  /^(the (situation|context) (was|is))/,
]

// Closing language that restates a result/takeaway (behavioral answers).
const CLOSE_PATTERNS = [
  /(in the end|in conclusion|to sum up|to wrap up)/,
  /(the (result|outcome|takeaway|upshot) (was|is|ended up))/,
  /(what i (learned|took away|realised|realized))/,
  /(ultimately|overall|net net|bottom line)/,
  /(so (we|i) (shipped|delivered|finished|launched|closed|landed|got it))/,
]

// A "tell me about yourself" / pitch closes by pointing forward — fit, intent,
// why-here — not with a project result.
const INTRO_CLOSE = [
  /(excited (about|to|for)|looking (to|forward)|hope to)/,
  /(that'?s (why|what brings|what drew)|drawn to|keen to)/,
  /(which is why i|that'?s me|in a nutshell|so that'?s)/,
]

// Intro opens by establishing identity/role.
const INTRO_HOOK = [
  /^(i'?m |i am |my name)/,
  /^(i'?ve (spent|been|worked|built))/,
  /^(i'?m a |i'?m an )/,
  /^(currently i|right now i|these days)/,
  /^(for the (last|past) \w+ years)/,
]

// Intro arc markers (present / past / future).
const INTRO_PRESENT = /(currently|right now|these days|at the moment|i work|i'?m a|i lead|i'?m based)/
const INTRO_PAST = /(before|previously|prior|i started|i grew|i studied|years ago|i used to|background)/
const INTRO_FUTURE = /(looking|excited|hope|want to|next|goal|aiming|that'?s why|drawn to)/

// Hedge endings that undercut a close.
const HEDGE_END = /(i guess|or whatever|or something|i suppose|kind of)\s*\.?\s*$/

const ORDINALS = [
  'first',
  'second',
  'third',
  'then',
  'next',
  'after that',
  'finally',
  'lastly',
  'another',
  'on top of that',
]
const TRANSITIONS = ['because', 'however', 'but', 'as a result', 'which meant', 'so that', 'the key']

const PROBLEM = /(behind schedule|broke|broken|bug|bugs|issue|issues|problem|conflict|struggl|blocked|slipping|missed|failing|upset|delayed)/
const SOLUTION = /(fixed|resolved|reorgan(i|is)ed|decided|rebuilt|built|shipped|aligned|talked to|prioriti|negotiat|delegat|automat|refactor|unblock)/
const RESULT = /(shipped|delivered|launched|on time|ahead of|saved|reduced|increased|grew|improved|result|outcome|in the end|we got)/

function words(t: string): string[] {
  return t.toLowerCase().match(/\b[\w']+\b/g) ?? []
}

// Detect what kind of answer this is, so we judge it by the right rubric.
function isIntro(prompt?: string, situation?: Situation): boolean {
  const s = `${prompt ?? ''} ${situation?.occasion ?? ''} ${situation?.purpose ?? ''}`.toLowerCase()
  return /(tell me about yourself|about you|introduce|introduction|elevator pitch|your background|who you are|walk me through your (background|cv|resume))/.test(
    s,
  )
}

export function scoreArrangement(
  transcript: string,
  situation?: Situation,
  prompt?: string,
): ArrangementResult {
  const text = transcript.toLowerCase().trim()
  const w = words(text)
  const n = w.length
  const opening = w.slice(0, 12).join(' ')
  const closing = w.slice(-18).join(' ')
  const intro = isIntro(prompt, situation)

  // --- Hook ---
  const fillerOpen = FILLER_OPEN.test(opening)
  const hookSet = intro ? INTRO_HOOK : HOOK_PATTERNS
  const strongHook = hookSet.some((re) => re.test(opening))
  const hasHook = strongHook || (!fillerOpen && n > 0)

  // --- Close ---
  const closeSet = intro ? INTRO_CLOSE : CLOSE_PATTERNS
  const hasClose = closeSet.some((re) => re.test(closing))
  const hedgeEnd = HEDGE_END.test(text)

  // --- Signposting ---
  const ordHits = ORDINALS.filter((o) => text.includes(o)).length
  const transHits = TRANSITIONS.filter((o) => text.includes(o)).length
  const signposts = ordHits + transHits
  const signposting: ArrangementResult['signposting'] =
    ordHits >= 2 || signposts >= 3 ? 'strong' : signposts >= 1 ? 'some' : 'weak'

  // --- Structure ---
  const hasProblem = PROBLEM.test(text)
  const hasSolution = SOLUTION.test(text)
  const hasResult = RESULT.test(text)
  // Exec/stakeholder contexts expect tighter answers -> lower ramble threshold.
  const ctx = `${situation?.occasion ?? ''} ${situation?.audience ?? ''}`.toLowerCase()
  const execContext = /(exec|stakeholder|leadership|board|review|standup|update)/.test(ctx)
  const rambleAt = execContext ? 170 : 230

  // Intro arc: how many of present / past / future are present.
  const introBeats =
    (INTRO_PRESENT.test(text) ? 1 : 0) +
    (INTRO_PAST.test(text) ? 1 : 0) +
    (INTRO_FUTURE.test(text) ? 1 : 0)

  let structure = 'other'
  if (intro) {
    if (introBeats >= 3) structure = 'present-past-future'
    else if (introBeats === 2) structure = 'partial arc'
    else if (n > rambleAt && signposting === 'weak') structure = 'rambling'
    else structure = 'flat intro'
  } else if (hasProblem && hasSolution && hasResult) structure = 'STAR'
  else if (hasProblem && hasSolution) structure = 'problem-solution'
  else if (ordHits >= 2) structure = 'list'
  else if (n > rambleAt && signposting === 'weak') structure = 'rambling'
  else if (n > rambleAt + 90) structure = 'rambling'

  // --- Score ---
  let score = 50
  if (strongHook) score += 15
  else if (fillerOpen) score -= 8
  else if (hasHook) score += 6

  if (hasClose) score += 18
  else score -= 8
  if (hedgeEnd) score -= 6

  score += signposting === 'strong' ? 12 : signposting === 'some' ? 6 : 0

  if (structure === 'STAR' || structure === 'present-past-future') score += 12
  else if (structure === 'problem-solution' || structure === 'partial arc') score += 8
  else if (structure === 'list') score += 4
  else if (structure === 'rambling') score -= 12
  else if (structure === 'flat intro') score -= 4

  if (n > rambleAt) score -= 8
  if (n > rambleAt + 110) score -= 8

  score = Math.max(22, Math.min(95, Math.round(score)))

  // --- Evidence + feedback (concrete, cites the actual answer) ---
  let evidence: string
  let feedback: string
  if (intro && fillerOpen) {
    evidence = `It opens with filler ("${w.slice(0, 3).join(' ')}…") instead of who you are.`
    feedback = 'Open with a crisp identity line: "I\'m a <role> who <does X>."'
  } else if (intro && introBeats < 2) {
    evidence = `The intro covers ${
      introBeats === 1 ? 'only one of' : 'almost none of'
    } the present → past → future arc.`
    feedback =
      'Use the arc: who you are now, the experience that got you here, and what you\'re aiming at.'
  } else if (intro && !hasClose) {
    const tail = w.slice(-6).join(' ')
    evidence = `It ends ("…${tail}") without pointing forward to why you\'re here.`
    feedback = 'Close by connecting your background to this role or goal.'
  } else if (!hasClose) {
    const tail = w.slice(-6).join(' ')
    evidence = `The answer trails off ("…${tail}") without restating the result.`
    feedback = 'Add one explicit closing line that names the outcome.'
  } else if (fillerOpen) {
    evidence = `It opens with filler ("${w.slice(0, 3).join(' ')}…") instead of the point.`
    feedback = 'Lead with a one-sentence headline answer, then back it up.'
  } else if (signposting === 'weak') {
    evidence = 'There are no verbal signposts, so the structure is hard to follow.'
    feedback = 'Signal the shape out loud: "There were three things. First… Second…"'
  } else if (structure === 'rambling') {
    evidence = `At ${n} words with little signposting, the answer rambles.`
    feedback = 'Tighten to Situation → Action → Result; cut the setup.'
  } else {
    evidence = `Clear ${structure} shape with a ${hasClose ? 'defined close' : 'close'}.`
    feedback = 'Solid structure — sharpen the opening hook to make it land faster.'
  }

  return {
    score,
    hasHook,
    hasClose,
    structure,
    signposting,
    evidence,
    feedback,
    source: 'heuristic',
  }
}
