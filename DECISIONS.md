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

## Infra
- **Rate limit + spend cap store:** Upstash Redis (free tier) via Vercel Marketplace; in-memory fallback when `UPSTASH_REDIS_REST_URL` is unset (local dev).
- **Deploy:** private GitHub repo + Vercel Git integration. Previews per push, `main` is production.
