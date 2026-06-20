import { useCallback, useRef, useState } from 'react'

// Audio capture (MediaRecorder) + live transcription (webkitSpeechRecognition).
// Browser-only, no API key. Key robustness fix: SpeechRecognition auto-ends on
// silence/timeout — we restart it while still recording so long answers don't
// silently stop transcribing.

export interface Recording {
  blob: Blob
  transcript: string
}

type Status = 'idle' | 'recording' | 'processing'

const MAX_SECONDS = 240 // safety cap

export function useRecorder() {
  const [status, setStatus] = useState<Status>('idle')
  const [transcript, setTranscript] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<any>(null)
  const finalTextRef = useRef('')
  const recordingRef = useRef(false) // true while the user is recording
  const timerRef = useRef<number | null>(null)
  const resolveRef = useRef<((r: Recording) => void) | null>(null)

  // Shared stop logic; returns the recording. Declared before start() so the
  // elapsed-timer safety cap can call it.
  const stopInternal = useCallback((): Promise<Recording> => {
    return new Promise((resolve) => {
      recordingRef.current = false
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      const rec = mediaRef.current
      if (!rec || rec.state === 'inactive') {
        try {
          recognitionRef.current?.stop()
        } catch {}
        resolve({
          blob: new Blob(chunksRef.current, { type: 'audio/webm' }),
          transcript: finalTextRef.current.trim(),
        })
        return
      }
      setStatus('processing')
      resolveRef.current = resolve
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        rec.stream.getTracks().forEach((t) => t.stop())
        try {
          recognitionRef.current?.stop()
        } catch {}
        // Give recognition a beat to flush final results.
        setTimeout(() => {
          resolveRef.current?.({ blob, transcript: finalTextRef.current.trim() })
        }, 400)
      }
      rec.stop()
    })
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setTranscript('')
    setElapsed(0)
    finalTextRef.current = ''
    chunksRef.current = []

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e: any) {
      setError('Microphone access denied. Use "Try a sample answer" instead.')
      throw e
    }

    const rec = new MediaRecorder(stream)
    mediaRef.current = rec
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    rec.start()
    recordingRef.current = true

    // Live transcription with auto-restart.
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      const recog = new SR()
      recog.continuous = true
      recog.interimResults = true
      recog.lang = 'en-US'
      recog.onresult = (ev: any) => {
        let interim = ''
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i]
          if (r.isFinal) finalTextRef.current += r[0].transcript + ' '
          else interim += r[0].transcript
        }
        setTranscript((finalTextRef.current + interim).trim())
      }
      recog.onerror = (e: any) => {
        // 'no-speech' / 'aborted' are recoverable; onend will restart.
        if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
          setError('Speech recognition blocked by the browser.')
        }
      }
      // The crucial fix: when recognition ends on its own, restart it if the
      // user is still recording.
      recog.onend = () => {
        if (recordingRef.current) {
          try {
            recog.start()
          } catch {
            /* will be retried on next end */
          }
        }
      }
      recognitionRef.current = recog
      try {
        recog.start()
      } catch {}
    }

    // Elapsed timer + safety cap.
    timerRef.current = window.setInterval(() => {
      setElapsed((s) => {
        const next = s + 1
        if (next >= MAX_SECONDS) void stopInternal()
        return next
      })
    }, 1000)

    setStatus('recording')
  }, [stopInternal])

  const stop = useCallback(() => stopInternal(), [stopInternal])

  const reset = useCallback(() => {
    recordingRef.current = false
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setStatus('idle')
    setTranscript('')
    setElapsed(0)
    setError(null)
  }, [])

  return { status, transcript, elapsed, error, start, stop, reset }
}
