# Communication Guru

AI communication coach that doesn't just diagnose — it **prescribes the fix and makes you drill it.**
See `PRD.md` for the product and `RESEARCH.md` for the rhetoric-based measurement model.

## V1 scope (built)

The **Great Speaker Stack**, layers 1–3 of 5:

- **Delivery** — pace (wpm), filler rate, pauses, vocal variety (RMS-energy analysis of the recording).
- **Arrangement** — hook, structure (STAR/problem-solution/rambling, intent-aware for intros), signposting, close.
- **Style** — concision (avg sentence length), jargon density, concreteness (`src/lib/style.ts`).
- **Coach Card** — picks the weakest of the three layers, names a technique from the rhetoric tradition, gives a 30-second drill, and prompts a re-record (with before/after deltas).
- **Shareable scorecard** — branded PNG generated on a canvas + copyable caption (`src/lib/share.ts`) — a built-in growth loop.

**Both layers are scored 100% in the browser** — no API key, no network, no signup, fully
private. Arrangement uses a keyword/position heuristic (`src/lib/arrangement.ts`) tuned to work
even on unpunctuated speech transcripts.

Plus the **coach loop made real**:
- **Progress dashboard** — sessions persist (localStorage), per-layer trend sparklines,
  day-streak, recurring-focus callout, session history. Turns one-shot feedback into a tracked
  journey of measurable improvement.
- **Freemium** — 3 free sessions, then a Pro upgrade (`src/lib/store.ts` gating + `plan.ts`
  pricing/checkout). 100% client-side ⇒ ~zero marginal cost per user.

_Next: layer in Invention, Style, Memory._

## Deploy (free static hosting)

Pure client-side SPA — deploys anywhere static:

```bash
npm run build            # -> dist/
npx netlify deploy --prod   # or: npx vercel --prod   (configs included)
```

Before charging: set `CHECKOUT_URL` in `src/lib/plan.ts` to a real payment link
(Stripe Payment Link / Gumroad / Razorpay) and adjust pricing.

## Run

```bash
npm install
npm run dev        # http://localhost:5173  (single Vite process, nothing else needed)
```

Use **"Try a sample answer"** to see the whole loop without a microphone. Live recording +
transcription uses the browser's `MediaRecorder` + `webkitSpeechRecognition` (Chrome/Edge).

## Upgrading Arrangement to an LLM (optional, later)

The heuristic has a clean seam. To swap in an LLM (e.g. a free Gemini/Groq tier): add a
`configureServer` middleware plugin to `vite.config.ts` exposing `/api/analyze`, and replace the
`scoreArrangement()` call in `src/App.tsx` with a `fetch` to it.

## Architecture

- `src/lib/delivery.ts` — audio + transcript → Delivery metrics.
- `src/lib/arrangement.ts` — heuristic Arrangement scorer (pure TS, in-browser).
- `src/lib/coach.ts` — technique/drill library; maps a diagnosis → prescription.
- `src/App.tsx` — setup → record → results UI.
