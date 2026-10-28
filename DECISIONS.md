# Decisions

Small calls made while building, newest at the bottom of each section.

## Product
- **Name:** Sayso (working name). Wordmark lowercase `sayso`, five-bar waveform mark.
- **Demo date anchoring:** the demo resolves relative dates against the real current date in `Asia/Kolkata`, so "Friday" always means the coming Friday for whoever opens it.

## Design
- **Direction (overrides brief §8 default):** owner supplied references (Ipsum voice-tutor landing, Speak ai, Upstream inbox). Took from them: near-white neutral canvas with a faint grid, white surfaces, tight-tracked grotesk display type, near-black pill CTAs, floating pill navbar, monospace chip tabs, a framed product UI under the hero with floating status chips, and an inline "Hold [key]" keycap line.
- **Type:** Geist for display and UI (600 weight, -0.045em tracking for display), Geist Mono for keycaps and tab chips only. Dropped the brief's serif suggestion to match the references.
- **Colour:** canvas `#f3f3f1`, surface `#fff`, ink `#141414`, mute `#66665f`, line `#e4e4e0`, one accent signal blue `#2348f0`. Status colours (ok green, warn amber, risk red) carry meaning only: answered / missing / suspicious. Iridescent blue→violet→orange gradient is reserved for the listening orb, the one loud element.
- **Dark theme:** full token swap under `.dark` via `next-themes` (class strategy, system default, no flash).
- **Motion:** one orchestrated hero loop (dictation streams in, asks tick off, gaps flag, draft + calendar chip appear), light scroll reveals, everything gated by `MotionConfig reducedMotion="user"` and a CSS reduced-motion override.

## Stack
- Next.js 16.4 (App Router, Turbopack, Cache Components on by default), React 19.3, Tailwind v4, shadcn/ui (base-nova style on Base UI), motion, lucide-react.
- `@types/node` bumped to 24 to satisfy Vitest 5 peer range.
- Node runtime everywhere; no edge runtime.

## LLM
- **Provider: Google Gemini** (owner's call, replaces the brief's Anthropic default) via `@google/genai`. Model from `GEMINI_MODEL`, default `gemini-3.5-flash` with thinking level LOW, falling back to `gemini-3.5-flash-lite` on 503 or timeout. Measured on 29 Oct 2026 with this key: `gemini-flash-latest` hung >60s, `gemini-3.8-flash` (the API's own recommendation) returned 503 "high demand" or took 11–45s, `3.5-flash` ~4s, `3.5-flash-lite` ~1.5s. `gemini-2.5-*` is closed to new keys.
- **Schema sanitising:** Gemini returns a bare 400 for some valid JSON Schema (many `maxItems` in one schema, ±2^53 integer bounds). We strip size bounds before sending; zod still enforces them on the response.
- **Structured output:** `responseMimeType: application/json` + `responseJsonSchema` generated from the zod schemas (`z.toJSONSchema`), then zod-validated; one retry with the validation error, then a friendly error.
- **Three calls per reply, not two:** `analyzeThread` (on open, cached), `buildProposal` core (facts, coverage, gaps, actions as JSON), then the reply body streamed as plain text from the validated plan. The reply writer never sees the raw dictation, so private asides and unverified facts can't leak into the email.
- **Actions are flattened** into one object shape for the model (Gemini's schema subset is happiest without unions) and narrowed server-side.
- **Safety guards (deterministic, server-side):** every action's `sourceQuote` must trace to the dictation (normalised substring or ≥80% word overlap, and any negation word must match exactly); calendar attendees must be thread participants; past dates and malformed times are dropped; regex injection detector runs alongside the model's own flag.
- **Weekday maths:** the prompt includes a 21-day table ("Friday 2026-10-30") so the model reads dates instead of computing them.

## Infra
- **Rate limit + spend cap store:** Upstash Redis **free plan** (500K commands/month, 250 MB), database `sayso` in us-east-1 next to the Vercel functions, auto-upgrade off so it can never bill. Created directly on Upstash; the Vercel Marketplace listing only offered paid plans. About 4 commands per LLM request. In-memory fallback when `UPSTASH_REDIS_REST_URL` is unset.
- **Limits:** 20 LLM requests per IP per 10 minutes (sliding window) and a global daily spend cap (default $5 per UTC day) estimated from Gemini token usage. Over the cap the app shows "The demo is busy right now. Try again later."
- **Deploy:** private GitHub repo + Vercel Git integration. Previews per push, `main` is production.

## Travel
- **Flights: Duffel v2 API in test mode only**, plain fetch (no SDK). The server refuses any token that doesn't start with `duffel_test_` and any offer with `live_mode: true`. Flow: offer request (time-of-day window mapped to `departure_time` from/to) → top 5 distinct offers by price → user picks → re-fetch offer for a current price and expiry → instant order paid from the test balance. Labelled "Test booking — no payment taken" on the card and in the confirmation.
- **Passenger:** a fixed fictional traveller (Asha Menon) on the server. No personal data or card details are ever collected.
- **Booked flights** are added to the in-app calendar.
- **Trains:** prefilled search link only, no automation.

## Calendar
- Replaced the agenda list with a real time grid: hour and half-hour lines, events positioned by time with Google-style lanes for overlaps, a red now-line, and the proposed invite drawn as a dashed block (red when it clashes). The side panel shows a day view with a Monday-start week strip and jumps to the proposal's day; a week view opens in a dialog.
- **Calendar hours:** working-hours window 10 am–5 pm at 40px per hour, no inner scroll. A day stretches only as far as needed to show an event outside that window (e.g. the 5 pm call, an early flight), so nothing the demo depends on is hidden.

## Dictation hotkey
- Wispr Flow's shortcut is user-configurable, so the app never asserts one. The composer says "Hold your Flow key", shows the platform default (fn on macOS, Ctrl + Win on Windows) labelled as the default, and offers "Set your key" to record the user's own combo. The choice is kept in this browser only (localStorage, wrapped in try/catch).

## Polish (milestone 7)
- **Landing performance:** scroll reveals, waveform, navbar menu and teaser use CSS instead of the animation library; the hero loop loads after `load` + idle; FAQ uses native `<details>`; toast and tooltip providers live in the app shell only. Lighthouse on production (29 Oct 2026, this machine): desktop 99/100/100/100; mobile performance 70–80 with accessibility, best practices and SEO at 100. The remaining mobile cost is React + Next.js hydration (~224 KB chunk) under 4x CPU throttling. PageSpeed Insights could not be run (shared API quota exhausted).
- **Screenshots** are captured from the deployed demo with the real model and Duffel test mode (`npm run screenshots`), never mocked, and only show the fictional inbox.
- **Smoke tests** stub the two LLM endpoints and freeze the browser clock so they are free and deterministic; real-model behaviour is covered by `npm run test:live`.
- **License:** MIT.
