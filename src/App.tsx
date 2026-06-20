import { useEffect, useState } from 'react'
import type { Situation, SessionResult } from './types'
import { useRecorder } from './lib/useRecorder'
import { analyzeDelivery, computeDeliveryFromText } from './lib/delivery'
import { scoreArrangement } from './lib/arrangement'
import { scoreStyle } from './lib/style'
import { buildCoachCard } from './lib/coach'
import { SAMPLE_AUDIO, SAMPLE_TRANSCRIPT } from './lib/sample'
import {
  type StoredSession,
  type Progress,
  loadSessions,
  saveSession,
  toStored,
  computeProgress,
  canStartSession,
  sessionsLeft,
  isPro,
  setPro,
  FREE_SESSION_LIMIT,
} from './lib/store'
import { PRICING, CHECKOUT_URL, UNLOCK_CODE, PRO_BENEFITS } from './lib/plan'
import { buildCaption, drawScorecard, downloadDataUrl } from './lib/share'

type Step = 'home' | 'setup' | 'record' | 'results'

const PROMPT_SUGGESTIONS = [
  'Tell me about yourself',
  'Give your 60-second elevator pitch',
  'Walk me through your background',
  'Tell me about a project you led',
  'Why do you want this role?',
]

export default function App() {
  const [sessions, setSessions] = useState<StoredSession[]>([])
  const [step, setStep] = useState<Step>('setup')
  const [situation, setSituation] = useState<Situation>({
    audience: 'Hiring manager',
    occasion: 'Job interview',
    purpose: 'Show competence under pressure',
  })
  const [question, setQuestion] = useState(PROMPT_SUGGESTIONS[0])
  const [result, setResult] = useState<SessionResult | null>(null)
  const [prev, setPrev] = useState<SessionResult | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [pro, setProState] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const rec = useRecorder()

  useEffect(() => {
    const s = loadSessions()
    setSessions(s)
    setProState(isPro())
    setStep(s.length > 0 ? 'home' : 'setup')
  }, [])

  const progress: Progress = computeProgress(sessions)
  const left = sessionsLeft(sessions.length)

  // A new session is gated by the free limit; re-record + new both go through here.
  function guardedStart(go: () => void) {
    if (canStartSession(sessions.length)) go()
    else setShowUpgrade(true)
  }

  async function runAnalysis(transcript: string, deliveryPromise: Promise<any>) {
    setAnalyzing(true)
    try {
      const delivery = await deliveryPromise
      const arrangement = scoreArrangement(transcript, situation, question)
      const style = scoreStyle(transcript)
      const coach = buildCoachCard(delivery, arrangement, style)
      const session: SessionResult = {
        situation,
        transcript,
        delivery,
        arrangement,
        style,
        coach,
      }
      setPrev(result)
      setResult(session)
      setSessions(saveSession(toStored(question, session)))
      setStep('results')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleStop() {
    const { blob, transcript } = await rec.stop()
    const text = transcript || SAMPLE_TRANSCRIPT
    const deliveryPromise =
      blob.size > 0 && transcript
        ? analyzeDelivery(blob, text)
        : Promise.resolve(computeDeliveryFromText(text, SAMPLE_AUDIO))
    await runAnalysis(text, deliveryPromise)
  }

  function handleSample() {
    void runAnalysis(
      SAMPLE_TRANSCRIPT,
      Promise.resolve(computeDeliveryFromText(SAMPLE_TRANSCRIPT, SAMPLE_AUDIO)),
    )
  }

  function applyUnlock() {
    setPro(true)
    setProState(true)
    setShowUpgrade(false)
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      <header className="mb-7 flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => setStep(sessions.length ? 'home' : 'setup')}
            className="text-left"
          >
            <h1 className="text-3xl font-extrabold tracking-tight text-guru">
              Communication&nbsp;Guru
            </h1>
          </button>
          <p className="text-slate-500 mt-1 text-sm">
            We don't just show what went wrong — we coach the fix.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {pro ? (
            <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
              ★ PRO
            </span>
          ) : (
            <>
              <span className="text-xs text-slate-400">
                {left} free left
              </span>
              <button
                onClick={() => setShowUpgrade(true)}
                className="text-xs font-semibold bg-guru text-white px-3 py-1.5 rounded-full hover:bg-violet-800"
              >
                Upgrade
              </button>
            </>
          )}
        </div>
      </header>

      {step === 'home' && (
        <Dashboard
          sessions={sessions}
          progress={progress}
          pro={pro}
          left={left}
          onNew={() => guardedStart(() => { rec.reset(); setStep('setup') })}
          onUpgrade={() => setShowUpgrade(true)}
        />
      )}

      {step === 'setup' && (
        <Setup
          situation={situation}
          setSituation={setSituation}
          question={question}
          setQuestion={setQuestion}
          onStart={() => setStep('record')}
          onBack={sessions.length ? () => setStep('home') : undefined}
        />
      )}

      {step === 'record' && (
        <RecordPanel
          question={question}
          status={rec.status}
          transcript={rec.transcript}
          elapsed={rec.elapsed}
          error={rec.error}
          analyzing={analyzing}
          onStart={() => void rec.start()}
          onStop={() => void handleStop()}
          onSample={handleSample}
          onBack={() => setStep('setup')}
        />
      )}

      {step === 'results' && result && (
        <Results
          result={result}
          prev={prev}
          onAgain={() => guardedStart(() => { rec.reset(); setStep('record') })}
          onHome={() => setStep('home')}
        />
      )}

      {showUpgrade && (
        <Upgrade
          onClose={() => setShowUpgrade(false)}
          onUnlock={applyUnlock}
        />
      )}
    </div>
  )
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
      {children}
    </div>
  )
}

function scoreColor(s: number) {
  if (s >= 75) return 'text-emerald-600'
  if (s >= 50) return 'text-amber-500'
  return 'text-red-500'
}
function barColor(s: number) {
  if (s >= 75) return 'bg-emerald-500'
  if (s >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}

function Sparkline({ series }: { series: number[] }) {
  if (series.length < 2)
    return <p className="text-xs text-slate-400 mt-2">Record again to see a trend.</p>
  return (
    <div className="flex items-end gap-1 h-12 mt-2">
      {series.map((v, i) => (
        <div
          key={i}
          title={`${v}`}
          className={`flex-1 rounded-t ${barColor(v)} opacity-80`}
          style={{ height: `${Math.max(8, v)}%` }}
        />
      ))}
    </div>
  )
}

function TrendCard({
  name,
  data,
}: {
  name: string
  data: { latest: number; delta: number; series: number[] }
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold text-slate-700">{name}</span>
        <span className={`text-2xl font-extrabold ${scoreColor(data.latest)}`}>
          {data.latest}
          {data.delta !== 0 && (
            <span
              className={`ml-2 text-sm font-bold ${
                data.delta > 0 ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {data.delta > 0 ? '▲' : '▼'}
              {Math.abs(data.delta)}
            </span>
          )}
        </span>
      </div>
      <Sparkline series={data.series} />
    </div>
  )
}

function Dashboard({
  sessions,
  progress,
  pro,
  left,
  onNew,
  onUpgrade,
}: {
  sessions: StoredSession[]
  progress: Progress
  pro: boolean
  left: number
  onNew: () => void
  onUpgrade: () => void
}) {
  const recent = [...sessions].reverse().slice(0, 5)
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Sessions" value={String(progress.total)} />
        <Stat label="Day streak" value={`${progress.streakDays}🔥`} />
        <Stat label="Best score" value={String(progress.bestScore)} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <TrendCard name="Delivery" data={progress.delivery} />
        <TrendCard name="Arrangement" data={progress.arrangement} />
        <TrendCard name="Style" data={progress.style} />
      </div>

      {progress.focusLayer && (
        <div className="rounded-xl bg-violet-50 border border-violet-100 p-4">
          <span className="text-xs uppercase tracking-wide text-violet-500 font-bold">
            Your recurring focus
          </span>
          <p className="text-slate-800 mt-1">
            <b>{progress.focusLayer}</b> has been your weakest layer in{' '}
            {progress.focusCount} of {progress.total} sessions. Keep drilling it —
            that's where your biggest gains are.
          </p>
        </div>
      )}

      <Card>
        <h2 className="text-lg font-bold mb-3">Recent sessions</h2>
        <ul className="divide-y divide-slate-100">
          {recent.map((s) => (
            <li key={s.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-slate-800 truncate">{s.prompt}</p>
                <p className="text-xs text-slate-400">
                  {new Date(s.date).toLocaleDateString()} · weakest: {s.weakestLayer}
                </p>
              </div>
              <div className="flex gap-2 text-sm font-bold shrink-0">
                <span className={scoreColor(s.deliveryScore)}>D {s.deliveryScore}</span>
                <span className={scoreColor(s.arrangementScore)}>A {s.arrangementScore}</span>
                <span className={scoreColor(s.styleScore)}>S {s.styleScore}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {!pro && left <= 1 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
          <p className="text-amber-800 text-sm">
            {left === 0
              ? "You've used your free sessions."
              : 'Last free session remaining.'}{' '}
            <button onClick={onUpgrade} className="font-bold underline">
              Go Pro for unlimited →
            </button>
          </p>
        </div>
      )}

      <button
        onClick={onNew}
        className="w-full bg-guru text-white font-semibold rounded-lg py-3.5 hover:bg-violet-800 transition"
      >
        ● Start a new session
      </button>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 text-center">
      <div className="text-2xl font-extrabold text-ink">{value}</div>
      <div className="text-xs text-slate-400 mt-0.5">{label}</div>
    </div>
  )
}

function Setup({
  situation,
  setSituation,
  question,
  setQuestion,
  onStart,
  onBack,
}: {
  situation: Situation
  setSituation: (s: Situation) => void
  question: string
  setQuestion: (q: string) => void
  onStart: () => void
  onBack?: () => void
}) {
  const field = (label: string, key: keyof Situation, placeholder: string) => (
    <label className="block">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <input
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-guru focus:ring-1 focus:ring-guru outline-none"
        value={situation[key]}
        placeholder={placeholder}
        onChange={(e) => setSituation({ ...situation, [key]: e.target.value })}
      />
    </label>
  )
  return (
    <Card>
      {onBack && (
        <button onClick={onBack} className="text-sm text-slate-400 mb-3">
          ← back to progress
        </button>
      )}
      <h2 className="text-lg font-bold mb-1">Set the rhetorical situation</h2>
      <p className="text-sm text-slate-500 mb-4">
        Good is relative to context. This re-weights how your answer is scored.
      </p>
      <div className="grid gap-4 sm:grid-cols-3 mb-5">
        {field('Audience', 'audience', 'Hiring manager')}
        {field('Occasion', 'occasion', 'Job interview')}
        {field('Purpose', 'purpose', 'Show competence')}
      </div>
      <label className="block mb-2">
        <span className="text-sm font-medium text-slate-600">
          What are you answering?
        </span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-guru focus:ring-1 focus:ring-guru outline-none"
          value={question}
          placeholder="e.g. Tell me about yourself — or type anything"
          onChange={(e) => setQuestion(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap gap-2 mb-5">
        {PROMPT_SUGGESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setQuestion(q)}
            className={`text-xs rounded-full px-3 py-1 border transition ${
              question === q
                ? 'bg-guru text-white border-guru'
                : 'bg-white text-slate-600 border-slate-200 hover:border-guru'
            }`}
          >
            {q}
          </button>
        ))}
      </div>
      <button
        onClick={onStart}
        className="w-full bg-guru text-white font-semibold rounded-lg py-3 hover:bg-violet-800 transition"
      >
        Continue →
      </button>
    </Card>
  )
}

function RecordPanel({
  question,
  status,
  transcript,
  elapsed,
  error,
  analyzing,
  onStart,
  onStop,
  onSample,
  onBack,
}: {
  question: string
  status: string
  transcript: string
  elapsed: number
  error: string | null
  analyzing: boolean
  onStart: () => void
  onStop: () => void
  onSample: () => void
  onBack: () => void
}) {
  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
  return (
    <Card>
      <button onClick={onBack} className="text-sm text-slate-400 mb-3">
        ← change situation
      </button>
      <div className="rounded-lg bg-violet-50 border border-violet-100 px-4 py-3 mb-5">
        <span className="text-xs uppercase tracking-wide text-violet-500 font-semibold">
          Your prompt
        </span>
        <p className="text-slate-800 font-medium">{question}</p>
      </div>

      {analyzing ? (
        <div className="text-center py-8">
          <div className="text-guru font-semibold animate-pulse">
            Analyzing your answer…
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Scoring Delivery + Arrangement — all in your browser
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 mb-4">
            {status !== 'recording' ? (
              <button
                onClick={onStart}
                className="bg-guru text-white font-semibold rounded-lg px-5 py-3 hover:bg-violet-800 transition"
              >
                ● Start recording
              </button>
            ) : (
              <button
                onClick={onStop}
                className="bg-red-500 text-white font-semibold rounded-lg px-5 py-3 hover:bg-red-600 transition animate-pulse"
              >
                ■ Stop & analyze
              </button>
            )}
            {status === 'recording' ? (
              <span className="font-mono text-red-500 font-bold tabular-nums">
                ● {mmss}
              </span>
            ) : (
              <button
                onClick={onSample}
                className="text-slate-600 font-medium rounded-lg px-4 py-3 border border-slate-200 hover:bg-slate-50"
              >
                Try a sample answer
              </button>
            )}
          </div>

          {error && <p className="text-sm text-red-500 mb-3">{error}</p>}

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 min-h-[96px]">
            <span className="text-xs uppercase tracking-wide text-slate-400 font-semibold">
              Live transcript
            </span>
            <p className="text-slate-700 mt-1">
              {transcript || (
                <span className="text-slate-400">
                  {status === 'recording'
                    ? 'Listening…'
                    : 'Press start and answer out loud, or try the sample.'}
                </span>
              )}
            </p>
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Tip: use Chrome or Edge for live transcription. Pitch, pace & energy
            are measured from your actual audio; exact "um"/"uh" counts depend on
            the browser transcriber.
          </p>
        </>
      )}
    </Card>
  )
}

function LayerScore({
  name,
  score,
  detail,
  focus,
  delta,
  details,
}: {
  name: string
  score: number
  detail: string
  focus: boolean
  delta?: number
  details?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className={`rounded-xl border p-4 ${
        focus ? 'border-guru bg-violet-50/40' : 'border-slate-100 bg-white'
      }`}
    >
      <div className="flex items-baseline justify-between">
        <span className="font-semibold text-slate-700">{name}</span>
        <span className={`text-2xl font-extrabold ${scoreColor(score)}`}>
          {score}
          {typeof delta === 'number' && delta !== 0 && (
            <span
              className={`ml-2 text-sm font-bold ${
                delta > 0 ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {delta > 0 ? '▲' : '▼'}
              {Math.abs(delta)}
            </span>
          )}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 mt-2 overflow-hidden">
        <div className={`h-full ${barColor(score)}`} style={{ width: `${score}%` }} />
      </div>
      <p className="text-xs text-slate-500 mt-2">{detail}</p>
      {details && (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs font-semibold text-guru mt-2 hover:underline"
          >
            {open ? '▾ hide breakdown' : '▸ see breakdown'}
          </button>
          {open && <div className="mt-2 pt-2 border-t border-slate-100">{details}</div>}
        </>
      )}
    </div>
  )
}

function SubBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-slate-500 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${barColor(value)}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`w-7 text-right font-bold ${scoreColor(value)}`}>{value}</span>
    </div>
  )
}

function Chips({ items }: { items: string[] }) {
  if (!items.length)
    return <span className="text-xs text-slate-400">none detected</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span
          key={i}
          className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5"
        >
          {t}
        </span>
      ))}
    </div>
  )
}

function Results({
  result,
  prev,
  onAgain,
  onHome,
}: {
  result: SessionResult
  prev: SessionResult | null
  onAgain: () => void
  onHome: () => void
}) {
  const { delivery, arrangement, style, coach } = result
  const dDelta = prev ? delivery.score - prev.delivery.score : undefined
  const aDelta = prev ? arrangement.score - prev.arrangement.score : undefined
  const sDelta = prev ? style.score - prev.style.score : undefined
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <LayerScore
          name="Delivery"
          score={delivery.score}
          focus={coach.weakestLayer === 'Delivery'}
          delta={dDelta}
          detail={`${delivery.wpm} wpm · ${delivery.fillerCount} fillers · variety ${delivery.subScores.variety}/100`}
          details={
            <div className="space-y-2">
              <SubBar label="Pace" value={delivery.subScores.pace} />
              <SubBar label="Fluency" value={delivery.subScores.fillers} />
              <SubBar label="Variety" value={delivery.subScores.variety} />
              <div className="text-xs text-slate-500 pt-1">
                <div className="mb-1">
                  Filler words:{' '}
                  <Chips
                    items={delivery.fillerBreakdown.map((f) => `${f.label} ×${f.n}`)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1">
                  <span>Pace: {delivery.wpm} wpm <span className="text-slate-400">(110–160)</span></span>
                  <span>Pitch range: {delivery.pitchVariation.toFixed(1)} st <span className="text-slate-400">(&gt;2.5 lively)</span></span>
                  <span>Pauses: {delivery.pauseCount}</span>
                  <span>Talk time: {Math.round(delivery.speakingRatio * 100)}%</span>
                </div>
              </div>
            </div>
          }
        />
        <LayerScore
          name="Arrangement"
          score={arrangement.score}
          focus={coach.weakestLayer === 'Arrangement'}
          delta={aDelta}
          detail={`${arrangement.structure} · hook ${
            arrangement.hasHook ? '✓' : '✗'
          } · close ${arrangement.hasClose ? '✓' : '✗'}`}
          details={
            <div className="text-xs text-slate-500 space-y-1">
              <div>Structure: <b>{arrangement.structure}</b></div>
              <div>Hook: {arrangement.hasHook ? '✓ yes' : '✗ missing'} · Close: {arrangement.hasClose ? '✓ yes' : '✗ missing'}</div>
              <div>Signposting: {arrangement.signposting}</div>
              <div className="italic pt-1">"{arrangement.evidence}"</div>
            </div>
          }
        />
        <LayerScore
          name="Style"
          score={style.score}
          focus={coach.weakestLayer === 'Style'}
          delta={sDelta}
          detail={`~${style.avgSentenceLen} w/sentence · ${style.jargonCount} jargon · concrete ${style.concreteness}/100`}
          details={
            <div className="space-y-2">
              <SubBar label="Concision" value={style.subScores.concision} />
              <SubBar label="Jargon" value={style.subScores.jargon} />
              <SubBar label="Concreteness" value={style.subScores.concreteness} />
              <div className="text-xs text-slate-500 pt-1">
                <div className="mb-1">Jargon used: <Chips items={style.jargonWords} /></div>
                <div>~{style.avgSentenceLen} words/sentence · {style.vagueCount} vague words</div>
              </div>
            </div>
          }
        />
      </div>

      <div className="rounded-2xl border-2 border-guru bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs uppercase tracking-wide bg-guru text-white px-2 py-0.5 rounded font-bold">
            Coach Card
          </span>
          <span className="text-sm text-slate-500">
            Weakest layer: <b>{coach.weakestLayer}</b>
          </span>
        </div>
        <h2 className="text-xl font-extrabold text-ink mt-2">{coach.technique}</h2>
        <p className="text-sm text-slate-500 italic mt-1">"{coach.evidence}"</p>
        <p className="text-slate-700 mt-3">{coach.why}</p>
        <div className="rounded-lg bg-violet-50 border border-violet-100 p-4 mt-4">
          <span className="text-xs uppercase tracking-wide text-violet-500 font-bold">
            30-second drill
          </span>
          <p className="text-slate-800 mt-1">{coach.drill}</p>
        </div>
        <p className="text-sm text-emerald-700 mt-3">{coach.encouragement}</p>
      </div>

      {prev && (
        <p className="text-center text-sm text-slate-500">
          Compared to your previous take — applying the technique should push the{' '}
          <b>{coach.weakestLayer}</b> bar up.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onAgain}
          className="bg-guru text-white font-semibold rounded-lg py-3 hover:bg-violet-800 transition"
        >
          ↻ Re-record with the technique
        </button>
        <button
          onClick={onHome}
          className="bg-white text-slate-700 font-semibold rounded-lg py-3 border border-slate-200 hover:bg-slate-50 transition"
        >
          See my progress →
        </button>
      </div>
      <button
        onClick={() => setShareUrl(drawScorecard(result))}
        className="w-full text-slate-500 font-medium rounded-lg py-2.5 border border-dashed border-slate-200 hover:bg-slate-50 transition text-sm"
      >
        ↗ Share my scorecard
      </button>

      {shareUrl && (
        <ShareModal
          imageUrl={shareUrl}
          caption={buildCaption(result)}
          onClose={() => setShareUrl(null)}
        />
      )}
    </div>
  )
}

function ShareModal({
  imageUrl,
  caption,
  onClose,
}: {
  imageUrl: string
  caption: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ text: caption })
        return
      }
    } catch {
      /* fall through to copy */
    }
    try {
      await navigator.clipboard.writeText(caption)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-extrabold text-guru">Share your progress</h2>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none">
            ×
          </button>
        </div>
        <img
          src={imageUrl}
          alt="Scorecard"
          className="rounded-xl border border-slate-100 w-full"
        />
        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            onClick={() => downloadDataUrl(imageUrl, 'communication-guru-scorecard.png')}
            className="bg-guru text-white font-semibold rounded-lg py-2.5 hover:bg-violet-800 transition text-sm"
          >
            ↓ Download image
          </button>
          <button
            onClick={share}
            className="bg-white text-slate-700 font-semibold rounded-lg py-2.5 border border-slate-200 hover:bg-slate-50 transition text-sm"
          >
            {copied ? '✓ Caption copied' : '⧉ Share / copy caption'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Upgrade({
  onClose,
  onUnlock,
}: {
  onClose: () => void
  onUnlock: () => void
}) {
  const [code, setCode] = useState('')
  const [err, setErr] = useState(false)
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-extrabold text-guru">Go Pro</h2>
          <button onClick={onClose} className="text-slate-400 text-xl leading-none">
            ×
          </button>
        </div>
        <p className="text-slate-500 text-sm mb-4">
          You get {FREE_SESSION_LIMIT} free sessions. Unlock unlimited coaching.
        </p>

        <div className="rounded-xl border-2 border-guru p-4 mb-4">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-extrabold text-ink">
              ₹{PRICING.proMonthlyINR}
            </span>
            <span className="text-slate-400">/month</span>
            <span className="text-xs text-slate-400 ml-auto">
              ${PRICING.proMonthlyUSD}/mo · ₹{PRICING.proAnnualINR}/yr
            </span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {PRO_BENEFITS.map((b) => (
              <li key={b} className="text-sm text-slate-700 flex gap-2">
                <span className="text-emerald-500 font-bold">✓</span> {b}
              </li>
            ))}
          </ul>
        </div>

        <a
          href={CHECKOUT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center bg-guru text-white font-semibold rounded-lg py-3 hover:bg-violet-800 transition"
        >
          Upgrade now →
        </a>

        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-xs text-slate-400 mb-2">
            Already paid? Enter your unlock code:
          </p>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setErr(false)
              }}
              placeholder="GURU-PRO"
              className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-guru outline-none"
            />
            <button
              onClick={() =>
                code.trim().toUpperCase() === UNLOCK_CODE ? onUnlock() : setErr(true)
              }
              className="bg-slate-800 text-white text-sm font-semibold rounded-lg px-4 hover:bg-slate-900"
            >
              Unlock
            </button>
          </div>
          {err && <p className="text-xs text-red-500 mt-1">Invalid code.</p>}
        </div>
      </div>
    </div>
  )
}
