# 🎤 PRODUCT REQUIREMENTS DOCUMENT
## Communication Guru — Don't Just Show the Problem, Coach the Fix

**Author:** Manu Gupta   |   **Date:** June 2026   |   **Version:** 1.0

---

## 1. Product Overview

**Product Name:** Communication Guru (working title)
**Platform:** Web app (responsive; mobile-friendly). Native later.
**Type:** AI communication coach (practice + feedback + remediation)
**One-liner:** *"Yoodli tells you what went wrong. We tell you exactly how to fix it — and make you practice it until you do."*

The product records a person speaking (public talk, interview answer, or stakeholder update), analyzes delivery and content, and — critically — returns a **named technique + a micro-drill + a re-record** for the single biggest weakness. It is a coach, not a report card.

---

## 2. Problem Statement

### For the speaker
- Existing tools **diagnose but don't remediate** — they show "you said 'um' 47 times, you spoke at 180 wpm" but never teach the technique to fix it.
- Feedback is a **wall of metrics** (visual, verbal, vocal), so users don't know what to fix first.
- **No measurable progress** — users can't see if they're actually improving week over week.
- The three highest-stakes contexts — **public speaking, interviews, talking to stakeholders** — each need different coaching, but tools treat them the same.

### Why existing apps fall short
- **Yoodli** — strong real-time analytics and AI roleplay, but reviewers cite *limited reporting depth* and *weak progress tracking*. It is a mirror, not a coach.
- **Orai** — affordable, lesson-driven, but generic; not personalized remediation.
- **Revarta** — moving toward *interpretation* ("the signal you missed") but interview-focused only.
- None close the loop: **Diagnose → Prescribe a fix → Drill it → Prove improvement.**

### The insight
Public-speaking research is unanimous: you don't fix filler words by counting them — you fix them with **pause-and-breathe**, **bridge phrases**, and **deliberate drills**. The fix is a *behavior loop*, not a *statistic*. That loop is the product.

---

## 3. Target Users

| Segment | Need | Context |
|---|---|---|
| Job seekers / switchers | Nail behavioral + technical interviews | Interview mode |
| Working professionals (PM, eng, sales) | Crisp stakeholder/exec updates | Stakeholder mode |
| Students / early-career | Build baseline speaking confidence | Public Speaking mode |
| Non-native English speakers | Pacing, clarity, filler reduction | All modes |

**Primary beachhead:** Interview practice (clear pain, clear willingness to pay, measurable outcome = offer).

---

## 4. Goals & Success Metrics

### Phase 1 Goals (0–3 months)
- Ship the **record → analyze → coach → re-record** loop for **one mode (Interview)**.
- Each session ends with **exactly one prescribed technique + one drill**.
- Track **one weakness per user** and show improvement across ≥3 sessions.
- Success metric: ≥60% of users who do 3+ sessions show measurable improvement on their tracked weakness.

### Phase 2 Goals (3–6 months)
- Add **Public Speaking** and **Stakeholder** modes with mode-specific rubrics.
- Add **AI roleplay personas** (interviewer / skeptical stakeholder / audience Q&A).
- Weekly "your top blocker this week" digest.
- Success metric: D30 retention ≥ 25%; ≥40% of paid users complete a weekly streak.

---

## 5. MVP Features

> **Measurement model:** we score the full **Great Speaker Stack** — the five canons of rhetoric — not just delivery. See `RESEARCH.md` for the science. Yoodli measures only Layer 5; this is the wedge.

### Must Have — V1 (Interview mode)
- **Rhetorical-situation setup** — before recording, pick **Audience / Occasion / Purpose**. This re-weights the scoring rubric (an exec update rewards concision + gravitas; a story answer rewards pathos). Context is a setup step, not an afterthought.
- **Record a response** — webcam + mic in-browser, or upload audio/video.
- **Transcription** — speech-to-text with timestamps.
- **5-layer analysis (the Great Speaker Stack):**
  1. **Invention** — substance: claim→evidence ratio, specificity, relevance, clear point.
  2. **Arrangement** — structure: hook, STAR/problem-solution detection, signposting, strong close, "buried the lede."
  3. **Style** — language: concision, jargon density, concreteness, processing-fluency.
  4. **Memory** — command: fluency under load, filler spikes at think-points, recovery.
  5. **Delivery** — vocal + nonverbal: vocal variety, pace, pauses, filler rate, energy (video signals in V2).
- **The Coach Card (the differentiator):**
  - Scores all 5 layers; surfaces the **weakest layer** (usually NOT delivery).
  - Names a **technique from a real rhetorical tradition** (e.g., Arrangement → "signpost-and-close"; Memory → "pause-and-breathe"; Delivery → "vocal-variety drill"). See technique library in `RESEARCH.md §6`.
  - Gives a **30–60s micro-drill**.
  - Prompts a **re-record** and shows before/after on that layer's score.
- **Progress tracker** — per-layer trend lines + one focus layer, tracked toward the **warmth × competence** target.

### V2 Features
- Public Speaking + Stakeholder modes (different rubrics/personas).
- AI roleplay (responsive interviewer/stakeholder personas).
- Question bank by role/company; "tell me about a time…" library.
- Video body-language signals (eye contact, gestures) — opt-in.
- Shareable progress report.

### Long-term Vision
- Real-time in-meeting nudges (browser extension / desktop overlay).
- Team/coach dashboards (managers, career coaches, bootcamps).
- Multilingual coaching.
- Personalized curriculum that sequences weaknesses over weeks.
- "Mock panel" — multiple AI personas at once (exec committee, hiring panel).

---

## 6. User Flow (MVP — Interview mode)

```
Launch App
  ├── Start Session
  │     ├── Pick mode (Interview) → pick question (or random behavioral)
  │     ├── Record answer (webcam/mic) OR upload
  │     ├── Processing → transcript + delivery + content analysis
  │     └── RESULTS SCREEN
  │           ├── Score summary (delivery + content)
  │           ├── 🎯 COACH CARD → #1 weakness + technique + micro-drill
  │           ├── Re-record this answer (apply the technique)
  │           └── Before/After on the tracked metric
  └── My Progress
        ├── Tracked weakness trend
        ├── Session history
        └── Weekly top-blocker digest
```

---

## 7. Technical Architecture

### Frontend (Web)
- **React + Vite** (or Next.js), Tailwind for UI.
- Browser **MediaRecorder API** for webcam/mic capture.
- Results dashboard + progress charts.
- Architecture pattern: component-driven, clear state separation (session vs. progress).

### Backend / AI
- **Speech-to-text:** Whisper (local) or a hosted STT for timestamps.
- **Delivery metrics:** computed from transcript + audio (filler counts, wpm, pause distribution) — deterministic, no LLM needed.
- **Layer scoring + coaching:** **Claude (Opus 4.8)** — scores the transcript across the 5 canons against a situation-weighted rubric and returns *structured JSON*: `{ layerScores: { invention, arrangement, style, memory, delivery }, weakestLayer, technique, drill, evidence, encouragement }`. (Layers 4–5 are partly deterministic from audio metrics; layers 1–3 are model-judged.)
- **Storage:** sessions, transcripts, tracked-weakness history.

### Infra (reuse what exists)
- **AWS free tier** (account already set up — $100 credits).
- Leverage the **existing local interview-transcribe-and-analyze pipeline** as the analysis seed.

---

## 8. Monetization

| Tier | Price | What you get |
|---|---|---|
| Free | $0 | 3 sessions/week, 1 mode, basic coach card |
| Pro | ~$8–12/mo | Unlimited sessions, all modes, roleplay, progress digest |
| Coach/Team | Custom | Dashboards for bootcamps, career coaches, managers |

Beachhead pricing anchored to interview prep (high willingness to pay around a job switch).

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| "Just another Yoodli" | Lead with remediation + single-weakness focus; that's the wedge. |
| AI coaching feels generic | Rubric-driven, evidence-cited feedback ("at 0:42 you rushed"); structured output. |
| Analysis cost per session | Deterministic metrics off-LLM; only content/coaching hits the model. |
| Privacy (video/voice) | Process and discard raw media by default; store transcripts + metrics only; explicit opt-in for video signals. |
| Scope creep across 3 modes | Ship Interview mode fully before adding others. |

---

## 10. Open Decisions (to resolve before build)

- **Video or audio-first for V1?** Audio-only is faster to ship and cheaper; video (body language) is a V2 differentiator. *Leaning: audio-first.*
- **Live in browser vs. upload?** In-browser record is the better UX; upload is the easy fallback. *Leaning: both, browser primary.*
- **STT: local Whisper vs. hosted?** Trades cost vs. setup. *Leaning: reuse local pipeline first.*
- **First mode:** Interview confirmed as beachhead.

---

## 11. Learning & Build Approach

**Method:** Explain → Build → Reflect
- **Explain** — concept/architecture explained before writing code.
- **Build** — written together with Claude Code.
- **Reflect** — explanation of what the code does and why it is structured that way.

**Build order (suggested):**
1. Browser record + upload → transcript on screen.
2. Deterministic delivery metrics (filler, wpm, pauses).
3. Claude coach card (structured JSON) for one weakness.
4. Re-record + before/after on tracked metric.
5. Progress tracker + history.
6. Then: second mode, roleplay personas.
