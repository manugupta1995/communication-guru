import { useCallback, useRef, useState } from 'react'

// Encapsulates audio capture (MediaRecorder) + live transcription
// (webkitSpeechRecognition). Browser-only, no API key. Chrome/Edge support
// SpeechRecognition; elsewhere the user can still record audio and we fall
// back gracefully (transcript may be empty -> use the sample path).

export interface Recording {
  blob: Blob
  transcript: string
}

type Status = 'idle' | 'recording' | 'processing'

export function useRecorder() {
  const [status, setStatus] = useState<Status>('idle')
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mediaRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<any>(null)
  const finalTextRef = useRef('')
  const resolveRef = useRef<((r: Recording) => void) | null>(null)

  const start = useCallback(async () => {
    setError(null)
    setTranscript('')
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

    // Live transcription (best-effort).
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
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
      recog.onerror = () => {}
      recognitionRef.current = recog
      try {
        recog.start()
      } catch {}
    }

    setStatus('recording')
  }, [])

  const stop = useCallback((): Promise<Recording> => {
    return new Promise((resolve) => {
      const rec = mediaRef.current
      if (!rec) {
        resolve({ blob: new Blob(), transcript: finalTextRef.current.trim() })
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
          resolveRef.current?.({
            blob,
            transcript: finalTextRef.current.trim() || transcript,
          })
        }, 350)
      }
      rec.stop()
    })
  }, [transcript])

  const reset = useCallback(() => {
    setStatus('idle')
    setTranscript('')
    setError(null)
  }, [])

  return { status, transcript, error, start, stop, reset }
}
