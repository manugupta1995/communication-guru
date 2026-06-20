import type { DeliveryMetrics } from '../types'
import { countFillers, wordCount } from './fillers'

// ---- Audio analysis ----------------------------------------------------
// One offline pass over the recorded audio buffer produces an RMS energy
// timeline. From that we derive vocal variety (the +30.5% TED lever) and
// pause count. Everything here is deterministic math — no AI, no network.

interface AudioFeatures {
  durationSec: number
  vocalVariety: number // coefficient of variation of voiced-frame energy
  pauseCount: number // silent gaps longer than MIN_PAUSE_SEC
}

const FRAME_MS = 50
const MIN_PAUSE_SEC = 0.4

function analyzeAudioBuffer(buf: AudioBuffer): AudioFeatures {
  const data = buf.getChannelData(0)
  const sr = buf.sampleRate
  const frameLen = Math.max(1, Math.floor((FRAME_MS / 1000) * sr))
  const rms: number[] = []

  for (let i = 0; i < data.length; i += frameLen) {
    let sum = 0
    const end = Math.min(i + frameLen, data.length)
    for (let j = i; j < end; j++) sum += data[j] * data[j]
    rms.push(Math.sqrt(sum / (end - i)))
  }

  const maxRms = Math.max(...rms, 1e-9)
  // Silence threshold relative to the loudest frame.
  const silence = maxRms * 0.12
  const voiced = rms.filter((r) => r > silence)

  // Vocal variety = how much the energy of *voiced* speech moves around.
  const mean = voiced.reduce((a, b) => a + b, 0) / (voiced.length || 1)
  const variance =
    voiced.reduce((a, b) => a + (b - mean) ** 2, 0) / (voiced.length || 1)
  const cv = mean > 0 ? Math.sqrt(variance) / mean : 0

  // Pauses = runs of consecutive silent frames longer than MIN_PAUSE_SEC,
  // ignoring leading/trailing silence.
  const minPauseFrames = Math.ceil((MIN_PAUSE_SEC * 1000) / FRAME_MS)
  let pauseCount = 0
  let run = 0
  let seenVoice = false
  for (const r of rms) {
    if (r <= silence) {
      if (seenVoice) run++
    } else {
      if (run >= minPauseFrames) pauseCount++
      run = 0
      seenVoice = true
    }
  }

  return { durationSec: buf.duration, vocalVariety: cv, pauseCount }
}

export async function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  const arrayBuf = await blob.arrayBuffer()
  const Ctx =
    window.AudioContext || (window as any).webkitAudioContext
  const ctx = new Ctx()
  try {
    return await ctx.decodeAudioData(arrayBuf)
  } finally {
    ctx.close()
  }
}

// ---- Scoring -----------------------------------------------------------

// Ideal conversational pace ~110-160 wpm. Score falls off outside that.
function paceScore(wpm: number): number {
  if (wpm >= 110 && wpm <= 160) return 100
  if (wpm < 110) return Math.max(20, Math.round(100 - (110 - wpm) * 1.3))
  return Math.max(20, Math.round(100 - (wpm - 160) * 1.1))
}

// Filler rate: <2% great, >8% poor.
function fillerScore(rate: number): number {
  if (rate <= 0.02) return 100
  if (rate >= 0.08) return 30
  return Math.round(100 - ((rate - 0.02) / 0.06) * 70)
}

// Vocal variety: CV ~0.5+ is lively; near 0 is monotone.
function varietyScore(cv: number): number {
  const s = Math.min(1, cv / 0.55) * 100
  return Math.max(15, Math.round(s))
}

export function computeDelivery(
  transcript: string,
  audio: AudioFeatures,
): DeliveryMetrics {
  const words = wordCount(transcript)
  const minutes = audio.durationSec / 60
  const wpm = minutes > 0 ? Math.round(words / minutes) : 0
  const fillers = countFillers(transcript)
  const fillerRate = words > 0 ? fillers.count / words : 0

  const sub = {
    pace: paceScore(wpm),
    fillers: fillerScore(fillerRate),
    variety: varietyScore(audio.vocalVariety),
  }
  // Weight variety + fillers a bit higher — strongest engagement signals.
  const score = Math.round(
    sub.pace * 0.3 + sub.fillers * 0.35 + sub.variety * 0.35,
  )

  return {
    durationSec: audio.durationSec,
    wordCount: words,
    wpm,
    fillerCount: fillers.count,
    fillerRate,
    fillerWords: fillers.words,
    pauseCount: audio.pauseCount,
    vocalVariety: audio.vocalVariety,
    score,
    subScores: sub,
  }
}

// Full pipeline from a recorded blob + transcript.
export async function analyzeDelivery(
  blob: Blob,
  transcript: string,
): Promise<DeliveryMetrics> {
  const buf = await decodeBlob(blob)
  const audio = analyzeAudioBuffer(buf)
  return computeDelivery(transcript, audio)
}

// For the sample / no-mic path: synthesize plausible audio features.
export function computeDeliveryFromText(
  transcript: string,
  opts: { durationSec: number; vocalVariety: number; pauseCount: number },
): DeliveryMetrics {
  return computeDelivery(transcript, opts)
}
