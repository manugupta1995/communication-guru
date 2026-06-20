// On-device speech-to-text via transformers.js (Whisper running in the browser
// over WebAssembly/WebGPU). 100% client-side: no backend, no API key, no cost.
// Unlike webkitSpeechRecognition this works in EVERY browser AND transcribes
// fillers ("um", "uh"). The model (~40MB, whisper-tiny.en) downloads once and
// is cached by the browser thereafter.

// Loaded from CDN via dynamic import so it never bloats the main bundle and
// only downloads when the user actually records.
const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1'
const MODEL = 'Xenova/whisper-tiny.en'

export type ProgressFn = (pct: number, label: string) => void

let transcriberPromise: Promise<any> | null = null

async function getTranscriber(onProgress?: ProgressFn): Promise<any> {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const TJS: any = await import(/* @vite-ignore */ TRANSFORMERS_CDN)
      TJS.env.allowLocalModels = false // we have no local model files on the site
      return TJS.pipeline('automatic-speech-recognition', MODEL, {
        progress_callback: (p: any) => {
          if (onProgress && typeof p?.progress === 'number') {
            onProgress(Math.round(p.progress), p.file || 'speech model')
          }
        },
      })
    })()
  }
  return transcriberPromise
}

// Decode any recorded blob and resample to 16kHz mono Float32 (what Whisper wants).
async function blobTo16kMono(blob: Blob): Promise<Float32Array> {
  const arr = await blob.arrayBuffer()
  const Ctx = window.AudioContext || (window as any).webkitAudioContext
  const ac = new Ctx()
  let decoded: AudioBuffer
  try {
    decoded = await ac.decodeAudioData(arr)
  } finally {
    ac.close()
  }
  const offline = new OfflineAudioContext(
    1,
    Math.max(1, Math.ceil(decoded.duration * 16000)),
    16000,
  )
  const src = offline.createBufferSource()
  src.buffer = decoded
  src.connect(offline.destination)
  src.start()
  const rendered = await offline.startRendering()
  return rendered.getChannelData(0)
}

export function isWhisperSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'AudioContext' in window &&
    typeof OfflineAudioContext !== 'undefined'
  )
}

// Transcribe a recorded audio blob. Throws on failure so callers can fall back.
export async function transcribeBlob(
  blob: Blob,
  onProgress?: ProgressFn,
): Promise<string> {
  const transcriber = await getTranscriber(onProgress)
  const audio = await blobTo16kMono(blob)
  const out = await transcriber(audio, { chunk_length_s: 30, stride_length_s: 5 })
  const text = (Array.isArray(out) ? out[0]?.text : out?.text) || ''
  return text.trim()
}

// Warm the model in the background (e.g. while the user is on the record screen)
// so the first real transcription isn't slowed by the download.
export function preloadWhisper(onProgress?: ProgressFn): void {
  if (isWhisperSupported()) void getTranscriber(onProgress).catch(() => {})
}
