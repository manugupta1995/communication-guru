import type {
  ArrangementResult,
  CoachCard,
  DeliveryMetrics,
  StyleResult,
} from '../types'

// Maps a diagnosed weakness to a named technique from the rhetoric tradition,
// plus a 30-60s micro-drill. This is the product's core promise: not "you said
// 'um' 12 times" but "here's the technique, here's the drill, now re-record."

interface Technique {
  technique: string
  why: string
  drill: string
}

const DELIVERY_TECHNIQUES = {
  fillers: {
    technique: 'Pause-and-Breathe (instead of filler)',
    why: 'Fillers appear when the mouth outruns the brain. A deliberate silent pause buys thinking time and reads as confidence, not hesitation.',
    drill: 'Re-record your answer. Every time you feel an "um" coming, close your mouth and take one slow breath instead. Silence is invisible to the listener — fillers are not.',
  },
  variety: {
    technique: 'Vocal Variety Drill',
    why: 'Top TED speakers use ~30% more vocal variety. A flat, monotone delivery makes even great content forgettable; listeners judge charisma on voice before content.',
    drill: 'Re-record and exaggerate on purpose: get genuinely loud on your most important sentence, then drop almost to a whisper on the next. Over-do it — it will still sound natural on playback.',
  },
  pace: {
    technique: 'Pace Control',
    why: 'Rushing is the #1 tell of nerves and it buries your key points. A controlled pace signals command of the material.',
    drill: 'Re-record one notch slower than feels comfortable. Put a full one-second stop after each key point — let it land before moving on.',
  },
} satisfies Record<string, Technique>

const ARRANGEMENT_TECHNIQUES = {
  noClose: {
    technique: 'Signpost-and-Close',
    why: 'An answer that just trails off leaves no impression. The close is what the listener remembers — a strong ending re-asserts your point.',
    drill: 'Re-record and end with one explicit closing line: "So the result was X, and what I took from it was Y." Name the takeaway out loud.',
  },
  noHook: {
    technique: 'Lead With The Answer (BLUF)',
    why: 'Burying the point forces the listener to dig for it. Stating your conclusion first frames everything that follows.',
    drill: 'Re-record starting with a single-sentence headline answer, then back it up. "The short version: we shipped it 2 weeks early. Here\'s how."',
  },
  structure: {
    technique: 'STAR Scaffolding',
    why: 'Rambling answers lose the listener. A skeleton — Situation, Task, Action, Result — keeps you and the audience oriented.',
    drill: 'Re-record using four beats out loud: the Situation (1 line), your Task, the Action you took, the Result. Spend most of your time on Action + Result.',
  },
  signpost: {
    technique: 'Signpost Your Structure',
    why: 'Without verbal road-signs the listener cannot follow the shape of your argument and tunes out.',
    drill: 'Re-record adding explicit signposts: "There were three problems. First… Second… And the last one…" Make the structure audible.',
  },
} satisfies Record<string, Technique>

// Intro / "tell me about yourself" answers have their own shape.
const INTRO_TECHNIQUES = {
  arc: {
    technique: 'Present → Past → Future Arc',
    why: 'A strong intro is a journey, not a list. Where you are now, the experience that built you, and where you\'re headed — that arc makes you memorable and relevant.',
    drill: 'Re-record in three beats: (1) "I\'m a <role> who <does X> today." (2) "I got here by <1-2 past steps>." (3) "Now I\'m looking to <goal that fits this room>."',
  },
  hook: {
    technique: 'Identity Hook',
    why: 'The first line of an intro sets the frame. Opening with filler or your life story buries who you actually are.',
    drill: 'Re-record opening with one sharp identity sentence: "I\'m a <role> who <the one thing that matters here>." Then expand.',
  },
  close: {
    technique: 'Forward-Looking Close',
    why: 'An intro that just stops leaves the listener asking "so what?". The close should connect your story to why you\'re in this room.',
    drill: 'Re-record ending with a bridge: "…which is exactly why I\'m excited about <this role / team / goal>." Tie your background to them.',
  },
} satisfies Record<string, Technique>

const INTRO_STRUCTURES = ['present-past-future', 'partial arc', 'flat intro']

const STYLE_TECHNIQUES = {
  concision: {
    technique: 'One Idea Per Sentence',
    why: 'Long, run-on sentences make the listener carry too much at once. Short sentences land — each one is a clean hit.',
    drill: 'Re-record forcing a full stop after every single idea. If you hear yourself say "and… and…", cut it and start a new sentence.',
  },
  jargon: {
    technique: 'Cut The Jargon',
    why: 'Buzzwords sound impressive but say nothing — they make you forgettable and hide whether you actually did the work.',
    drill: 'Re-record and swap every buzzword for the plain version: not "leverage synergies" but "we worked together to ship X".',
  },
  concreteness: {
    technique: 'Concrete Over Abstract',
    why: 'Vague words ("stuff", "a lot", "things") evaporate. Specifics — numbers, names, outcomes — stick and prove you were there.',
    drill: 'Re-record replacing every vague word with one concrete detail: not "improved it a lot" but "cut load time from 4s to 1.2s".',
  },
} satisfies Record<string, Technique>

export function buildCoachCard(
  delivery: DeliveryMetrics,
  arrangement: ArrangementResult,
  style: StyleResult,
): CoachCard {
  // Pick the single weakest layer across the whole stack.
  const layers: { layer: CoachCard['weakestLayer']; score: number }[] = [
    { layer: 'Delivery', score: delivery.score },
    { layer: 'Arrangement', score: arrangement.score },
    { layer: 'Style', score: style.score },
  ]
  const weakest = layers.reduce((a, b) => (b.score < a.score ? b : a)).layer

  let t: Technique
  let evidence: string

  if (weakest === 'Style') {
    const { concision, jargon, concreteness } = style.subScores
    const lowest = Math.min(concision, jargon, concreteness)
    if (lowest === jargon) {
      t = STYLE_TECHNIQUES.jargon
      const top = style.jargonWords.slice(0, 3).join('", "')
      evidence = `You leaned on jargon${top ? ` ("${top}")` : ''} — ${style.jargonCount} buzzword${style.jargonCount === 1 ? '' : 's'} that add no real information.`
    } else if (lowest === concreteness) {
      t = STYLE_TECHNIQUES.concreteness
      evidence = `Concreteness scored ${concreteness}/100 — ${style.vagueCount} vague words and few specifics, so nothing sticks.`
    } else {
      t = STYLE_TECHNIQUES.concision
      evidence = `Your sentences ran ~${style.avgSentenceLen} words long — too much to hold in one breath.`
    }
  } else if (weakest === 'Delivery') {
    const { pace, fillers, variety } = delivery.subScores
    const lowest = Math.min(pace, fillers, variety)
    if (lowest === fillers) {
      t = DELIVERY_TECHNIQUES.fillers
      const top = delivery.fillerWords.slice(0, 3).join('", "')
      evidence = `You used ${delivery.fillerCount} filler words${
        top ? ` (mostly "${top}")` : ''
      } — ${Math.round(delivery.fillerRate * 100)}% of everything you said.`
    } else if (lowest === variety) {
      t = DELIVERY_TECHNIQUES.variety
      evidence = `Your vocal variety scored ${variety}/100 — the delivery stayed fairly flat, so key points didn't stand out.`
    } else {
      t = DELIVERY_TECHNIQUES.pace
      evidence =
        delivery.wpm > 160
          ? `You spoke at ${delivery.wpm} words/min — faster than the ~110-160 sweet spot, which reads as rushed.`
          : `You spoke at ${delivery.wpm} words/min — slower than the ~110-160 sweet spot, which can drag.`
    }
  } else if (INTRO_STRUCTURES.includes(arrangement.structure)) {
    // Intro / "tell me about yourself" — coach the intro shape, not STAR.
    if (arrangement.structure !== 'present-past-future')
      t = INTRO_TECHNIQUES.arc
    else if (!arrangement.hasClose) t = INTRO_TECHNIQUES.close
    else t = INTRO_TECHNIQUES.hook
    evidence = arrangement.evidence || arrangement.feedback
  } else {
    if (!arrangement.hasClose) t = ARRANGEMENT_TECHNIQUES.noClose
    else if (!arrangement.hasHook) t = ARRANGEMENT_TECHNIQUES.noHook
    else if (arrangement.signposting === 'weak')
      t = ARRANGEMENT_TECHNIQUES.signpost
    else t = ARRANGEMENT_TECHNIQUES.structure
    evidence = arrangement.evidence || arrangement.feedback
  }

  return {
    weakestLayer: weakest,
    technique: t.technique,
    why: t.why,
    drill: t.drill,
    evidence,
    encouragement: {
      Delivery: 'Your content held up — fix this one delivery habit and the whole answer levels up.',
      Arrangement: 'Your delivery is solid — tighten the structure and this becomes a genuinely strong answer.',
      Style: 'The bones are good — sharpen the language and this lands much harder.',
    }[weakest],
  }
}
