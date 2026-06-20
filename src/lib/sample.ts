// Canned "tell me about yourself" answer for the no-microphone / demo path.
// Deliberately imperfect: opens with filler (not an identity line), covers
// present + past but no forward-looking "why I'm here", hedged ending, rushed
// and filler-heavy — so the coach has plenty to catch.

export const SAMPLE_TRANSCRIPT =
  "So, um, yeah, my name is, like, Manu and I'm basically a, you know, product manager. I've been working in tech for, um, a few years now and I actually started out in engineering and then kind of moved into product. I work on, you know, mobile apps mostly and, um, I really like building things that, like, people actually use. Before this I, uh, was at a startup doing similar stuff. Yeah, so that's, like, pretty much me I guess."

// Synthetic delivery features for the sample (no real audio): rushed, flat,
// hesitant — matching the filler-heavy text.
export const SAMPLE_AUDIO = {
  durationSec: 24,
  vocalVariety: 0.22, // low -> fairly monotone
  pitchVariation: 1.1, // semitones (flat)
  dynamicRange: 1.25,
  pauseCount: 4,
  speakingRatio: 0.62, // lots of dead air / hesitation
}
