import type { DeliveryMetrics } from '../types'
import { countFillers, wordCount } from './fillers'

// ---- Audio analysis ----------------------------------------------------
// One offline pass over the recording produces honest, discriminating delivery
// signals — all deterministic math, no AI, no network:
//   - pitch (F0) variation  -> intonation range; separates monotone reading
//     from expressive natural speech (the real "vocal variety")
//   - energy dynamic range  -> loudness expressiveness
//   - pauses + speaking ratio -> hesitation / disfluency proxy
//   - words-per-minute      -> pace

export interface AudioFeatures {
  durationSec: number
  vocalVariety: number // 0..1 composite (pitch + dynamics)
  pitchVariation: number // semitone std-dev of F0 (display)
  dynamicRange: number // p90/median of voiced energy (display)
  pauseCount: number
  speakingRatio: number // voiced time / total time (low = lots of silence)
}

const TARGET_SR = 16000
const FRAME_MS = 40
const HOP_MS = 20
const MIN_PAUSE_SEC = 0.4

function downsample(data: Float32Array, sr: number): { d: Float32Array; sr: number } {
  if (sr <= TARGET_SR) return { d: data, sr }
  const factor = Math.floor(sr / TARGET_SR)
  const out = new Float32Array(Math.floor(data.length / factor))
  for (let i = 0; i < out.length; i++) out[i] = data[i * factor]
  return { d: out, sr: Math.floor(sr / factor) }
}

// Fundamental-frequency estimate for one frame via normalized autocorrelation.
// Returns 0 for unvoiced/silent frames.
function detectF0(frame: Float32Array, sr: number, silence: number): number {
  let energy = 0
  for (let i = 0; i < frame.length; i++) energy += frame[i] * frame[i]
  const rms = Math.sqrt(energy / frame.length)
  if (rms < silence) return 0

  const minLag = Math.floor(sr / 350) // 350 Hz
  const maxLag = Math.floor(sr / 70) // 70 Hz
  let bestLag = -1
  let bestCorr = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0
    for (let i = 0; i < frame.length - lag; i++) corr += frame[i] * frame[i + lag]
    corr /= frame.length - lag
    if (corr > bestCorr) {
      bestCorr = corr
      bestLag = lag
    }
  }
  // Voicing test: clear periodicity relative to frame energy.
  if (bestLag < 0 || bestCorr < 0.28 * (energy / frame.length)) return 0
  return sr / bestLag
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

// Pure feature extraction from raw mono samples — testable without a real file.
export function computeFeaturesFromSamples(
  raw: Float32Array,
  rawSr: number,
): AudioFeatures {
  const { d: data, sr } = downsample(raw, rawSr)
  const win = Math.floor((FRAME_MS / 1000) * sr)
  const hop = Math.floor((HOP_MS / 1000) * sr)
  const durationSec = raw.length / rawSr

  // Per-frame energy.
  const rmsArr: number[] = []
  for (let i = 0; i + win <= data.length; i += hop) {
    let e = 0
    for (let j = i; j < i + win; j++) e += data[j] * data[j]
    rmsArr.push(Math.sqrt(e / win))
  }
  if (rmsArr.length === 0)
    return {
      durationSec,
      vocalVariety: 0,
      pitchVariation: 0,
      dynamicRange: 1,
      pauseCount: 0,
      speakingRatio: 0,
    }

  const maxRms = Math.max(...rmsArr, 1e-9)
  const silence = maxRms * 0.1
  const voicedRms = rmsArr.filter((r) => r > silence).sort((a, b) => a - b)
  const speakingRatio = voicedRms.length / rmsArr.length

  // Dynamic range of loudness (expressiveness in volume).
  const median = percentile(voicedRms, 50) || 1e-9
  const dynamicRange = percentile(voicedRms, 90) / median

  // Pauses: runs of silence > MIN_PAUSE_SEC, ignoring leading/trailing.
  const minPauseFrames = Math.ceil(MIN_PAUSE_SEC / (HOP_MS / 1000))
  let pauseCount = 0
  let run = 0
  let seenVoice = false
  for (const r of rmsArr) {
    if (r <= silence) {
      if (seenVoice) run++
    } else {
      if (run >= minPauseFrames) pauseCount++
      run = 0
      seenVoice = true
    }
  }

  // Pitch track over voiced frames -> intonation range in semitones.
  const f0s: number[] = []
  for (let i = 0; i + win <= data.length; i += hop) {
    const f0 = detectF0(data.subarray(i, i + win), sr, silence)
    if (f0 > 0) f0s.push(f0)
  }
  let pitchVariation = 0
  if (f0s.length > 4) {
    const sortedF0 = [...f0s].sort((a, b) => a - b)
    const medF0 = percentile(sortedF0, 50) || 1
    // Std-dev of semitone deviations from the median pitch.
    const semis = f0s.map((f) => 12 * Math.log2(f / medF0))
    const mean = semis.reduce((a, b) => a + b, 0) / semis.length
    const varr = semis.reduce((a, b) => a + (b - mean) ** 2, 0) / semis.length
    pitchVariation = Math.sqrt(varr)
  }

  // Composite variety: intonation (primary) + loudness dynamics (secondary).
  const pitchPart = Math.min(1, pitchVariation / 3.5) // ~3.5 ST = lively
  const dynPart = Math.min(1, (dynamicRange - 1) / 1.0)
  const vocalVariety = Math.max(0, 0.7 * pitchPart + 0.3 * dynPart)

  return { durationSec, vocalVariety, pitchVariation, dynamicRange, pauseCount, speakingRatio }
}

export async function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  const arrayBuf = await blob.arrayBuffer()
  const Ctx = window.AudioContext || (window as any).webkitAudioContext
  const ctx = new Ctx()
  try {
    return await ctx.decodeAudioData(arrayBuf)
  } finally {
    ctx.close()
  }
}

// ---- Scoring (recalibrated for honest spread) --------------------------

// Smooth gradient around ~135 wpm. Slow drags, fast rushes — both cost.
function paceScore(wpm: number): number {
  if (wpm <= 0) return 50
  const diff = wpm - 135
  const k = diff < 0 ? 0.7 : 0.95
  return Math.max(10, Math.min(100, Math.round(100 - Math.abs(diff) * k)))
}

// Fluency: filler density (from transcript) + a hesitation penalty from
// silence ratio — so the choppy/filler-heavy take is caught even when the
// browser transcriber drops the literal "um".
function fluencyScore(fillerRate: number, speakingRatio: number): number {
  const fillerPart = Math.max(10, Math.min(100, Math.round(100 - fillerRate * 900)))
  // Lots of dead air (speakingRatio < 0.7) reads as hesitant.
  const hesitation = speakingRatio < 0.7 ? (0.7 - speakingRatio) * 130 : 0
  return Math.max(8, Math.min(100, Math.round(fillerPart - hesitation)))
}

function varietyScore(vocalVariety: number): number {
  return Math.max(8, Math.min(100, Math.round(vocalVariety * 100)))
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
    fillers: fluencyScore(fillerRate, audio.speakingRatio),
    variety: varietyScore(audio.vocalVariety),
  }
  // Variety weighted highest — it's the most honest discriminator.
  const score = Math.round(sub.pace * 0.25 + sub.fillers * 0.35 + sub.variety * 0.4)

  return {
    durationSec: audio.durationSec,
    wordCount: words,
    wpm,
    fillerCount: fillers.count,
    fillerRate,
    fillerWords: fillers.words,
    fillerBreakdown: fillers.breakdown,
    pauseCount: audio.pauseCount,
    vocalVariety: audio.vocalVariety,
    pitchVariation: audio.pitchVariation,
    dynamicRange: audio.dynamicRange,
    speakingRatio: audio.speakingRatio,
    score,
    subScores: sub,
  }
}

export async function analyzeDelivery(
  blob: Blob,
  transcript: string,
): Promise<DeliveryMetrics> {
  const buf = await decodeBlob(blob)
  return computeDelivery(transcript, computeFeaturesFromSamples(buf.getChannelData(0), buf.sampleRate))
}

// Sample / no-mic path: caller supplies synthetic audio features.
export function computeDeliveryFromText(
  transcript: string,
  features: AudioFeatures,
): DeliveryMetrics {
  return computeDelivery(transcript, features)
}
