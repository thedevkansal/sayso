# Sayso

**Answer email by talking.** Hold your Wispr Flow key, ramble your reply, and Sayso maps it to every question in the thread, flags what you forgot, drafts the email and lines up the follow-ups. Nothing is sent without your click.

[![No Hands: The Wispr Challenge](https://img.shields.io/badge/No%20Hands-The%20Wispr%20Challenge-141414)](#built-with-wispr-flow)
[![License: MIT](https://img.shields.io/badge/license-MIT-2348f0)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-App%20Router-black?logo=nextdotjs)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Gemini](https://img.shields.io/badge/LLM-Google%20Gemini-4285f4?logo=googlegemini&logoColor=white)](https://ai.google.dev)

### [▶ Try the live demo, no login](https://sayso-delta.vercel.app/app)

![Sayso landing page](docs/screenshots/01-landing.png)

## Overview

Busy people get emails that ask five things at once, and answering them means switching back and forth between the thread and a half-written reply. Speaking is faster than typing, and Wispr Flow already turns speech into text anywhere, but a raw transcript doesn't know what the sender asked. Sayso is built for that gap: you talk the way you would to a colleague (out of order, with "no wait" corrections and Hinglish), and it checks your words against the thread, writes a clean point-by-point reply, and proposes the calendar invite or travel you mentioned. It is for anyone who answers logistics-heavy email (event organisers, founders, ops leads) and would rather say it than type it.

## Features

- **Ask extraction**: reads the thread and lists every question the sender asked (`analyzeThread` in `lib/pipeline`).
- **Coverage check**: marks each question answered, partly answered or missing, and nudges you about the gaps before you send.
- **"What I understood" panel**: every fact sits next to the exact words it came from; self-corrections, private asides and doubtful phrases (a dropped "not") are labelled.
- **Streamed, editable draft**: the reply streams in from a validated plan and stays editable.
- **Confirm cards for every action**: send, calendar invite and test flight booking each wait for an explicit click.
- **Calendar with conflict detection**: relative dates resolve to absolute times ("Fri 6 Nov, 5:00–5:30 pm IST"), clashes are shown, and the next free slot is offered.
- **Travel**: flight offers and test bookings through Duffel's test environment; trains open a prefilled search link.
- **Prompt-injection defence**: email text is fenced as data, flagged when it addresses an AI, and actions must trace back to your own words (`lib/pipeline/guards.ts`).
- **Two modes**: a no-login demo on a fictional inbox, and live mode on your Gmail and Google Calendar.
- **Built for dictation**: one large composer, your own Flow hotkey shown in the hint, keyboard shortcuts for drafting and sending.

## Screenshots

| | |
|---|---|
| ![Thread with the dictation composer](docs/screenshots/02-thread-composer.png) **Thread and composer**: the questions Sayso found, and a rambled answer. | ![Coverage and missing answers](docs/screenshots/03-understood-and-gaps.png) **What I understood**: 4 of 6 answered, two flagged as missing. |
| ![Calendar invite with a conflict](docs/screenshots/04-calendar-conflict.png) **Confirm card**: the "4 pm, no wait, 5" call clashes with a booked event; a free slot is offered. | ![Flight options from Duffel test mode](docs/screenshots/05-travel.png) **Travel**: test fares for two travellers, from a Hinglish request. |
| ![Suspicious email warning](docs/screenshots/06-suspicious-email.png) **Injection email**: instructions aimed at an AI are flagged and ignored. | ![Landing page](docs/screenshots/01-landing.png) **Landing page** with the animated product loop. |

All screenshots use the fictional demo inbox, captured with `npm run screenshots`.

## Try it in 60 seconds

1. Open **[sayso-delta.vercel.app/app](https://sayso-delta.vercel.app/app)**. *You see a five-email inbox, with Mira Okafor's thread open and "6 questions to answer" on the right.*
2. Click the composer, hold your Wispr Flow key and say (or paste): *"Okay so she's arriving the 14th, talk is 30 minutes, yes we cover the hotel, and set a call with her Friday 4 pm, no wait, 5."*
3. Press **Ctrl + Enter** (⌘ + Enter on a Mac). *The right panel shows about 4 of 6 answered, a "You didn't answer these" box for AV and dietary needs, and the 4 pm to 5 pm correction.*
4. Scroll to **Confirm to act**. *The calendar card shows the call on Friday at 5:00 pm with a clash against a sponsor review, and offers a free slot.*
5. Click **Book 5:15 pm instead**, then **Send reply**. *The draft updates to the new time, the event appears on the calendar, and the reply lands in the Sent tab.*
6. Open **Accounts Desk** in the inbox. *A red banner says the email's instructions to an AI were ignored.*

Model output varies a little between runs; the exact wording of the draft will differ. **Reset demo** restores everything.

## Run it locally

Requires Node.js and npm.

```bash
git clone https://github.com/thedevkansal/sayso.git
cd sayso
npm install
cp .env.example .env.local   # then fill in at least GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

| Variable | Required | What it's for | Where to get it |
|---|---|---|---|
| `GEMINI_API_KEY` | **Yes** | Thread analysis and reply drafting | [Google AI Studio](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | No | Primary model and the lighter fallback on overload or timeout | Defaults in `.env.example` |
| `GEMINI_THINKING_LEVEL`, `GEMINI_TIMEOUT_MS` | No | Model thinking level and per-call timeout | Defaults in `.env.example` |
| `LLM_PRICE_IN_PER_M`, `LLM_PRICE_OUT_PER_M` | No | Token prices used to estimate spend for the daily cap | Defaults in `.env.example` |
| `DAILY_SPEND_CAP_USD`, `RATE_LIMIT_PER_10MIN` | No | Public-demo guards: daily model spend cap and per-IP request limit | Choose your own |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | No | Shared store for rate limits and spend; in-memory if unset | [Upstash console](https://console.upstash.com) (free plan) |
| `DUFFEL_TEST_TOKEN` | No | Flight search and test bookings; must be a `duffel_test_` token | Duffel dashboard, Access tokens (test mode) |
| `AUTH_SECRET` | Live mode | Encrypts the session cookie | Generate random bytes (command in `.env.example`) |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Live mode | Google OAuth client for Gmail and Calendar | Google Cloud Console; redirect URIs in `.env.example` |
| `NEXT_PUBLIC_SITE_URL` | No | Base URL for metadata and the OG image | Your deployment URL |

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` then `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Vitest): pipeline guards, dates, injection and edge cases |
| `npm run test:live` | Evals against the real model (needs `GEMINI_API_KEY`) |
| `npm run e2e` | Playwright smoke tests (model calls stubbed; first run needs `npx playwright install chromium`) |
| `npm run screenshots` | Re-capture the README screenshots from the deployed demo |

## Architecture

```mermaid
flowchart LR
  user([You + Wispr Flow]) --> ui[Next.js app<br/>inbox, composer, confirm cards]
  ui --> ls[(Browser storage<br/>demo state only)]
  ui --> analyze["/api/analyze"]
  ui --> propose["/api/propose<br/>(NDJSON stream)"]
  ui --> travel["/api/travel/*"]
  ui --> live["/api/live/*"]
  analyze --> guard[Rate limit + spend cap]
  propose --> guard
  guard --> redis[(Upstash Redis)]
  analyze --> gemini[Google Gemini]
  propose --> gemini
  travel --> duffel[Duffel API<br/>test mode]
  live --> auth[Auth.js session<br/>encrypted cookie]
  live --> gmail[Gmail API]
  live --> gcal[Google Calendar API]
```

```mermaid
sequenceDiagram
  actor U as You
  participant App as Sayso UI
  participant API as Route handlers
  participant LLM as Gemini
  participant Svc as Gmail / Calendar / Duffel
  U->>App: Open a thread
  App->>API: POST /api/analyze (thread)
  API->>LLM: Extract asks (email fenced as data)
  LLM-->>App: asks[], suspicious flag
  U->>App: Hold Flow key and ramble
  App->>API: POST /api/propose (thread, asks, dictation)
  API->>LLM: Facts, coverage, gaps, actions (JSON)
  API->>API: Guards: actions must quote your words
  API-->>App: Plan, then streamed reply
  U->>App: Click a confirm card
  App->>Svc: Send / add event / book test flight
  Svc-->>App: Done
```

- **LLM pipeline** (`lib/pipeline`, `lib/llm`): structured JSON validated with zod and retried once. The reply writer only sees the validated plan, never the raw dictation.
- **Safety**: email bodies are wrapped in fenced data blocks. Each action must quote your dictation (negations must match exactly). Invitees must already be in the thread, and nothing runs without a click.
- **No database**: demo state lives in your browser; live data stays in memory and the session is an encrypted httpOnly cookie.

## Built with Wispr Flow

> **TODO (author):** In your own words, describe how you used Wispr Flow while building Sayso and while using it: what you dictated, where it helped, what surprised you. Please don't add numbers you didn't measure.

## Limitations

- **Live mode is for approved test users only.** The Google OAuth app is in Testing mode, so only accounts added as test users can connect, and Google may ask you to sign in again after about seven days.
- **Flights are Duffel test mode.** No real tickets and no payment; fares are test data (in USD). In test mode only Duffel Airways books reliably, and some other carriers' test fares refuse orders, so the card leads with Duffel Airways and marks refused fares.
- **Trains are a search link only.** No booking automation.
- **The public demo is rate limited** (per-IP requests and a daily model spend cap), so it can show "The demo is busy right now" under heavy use.
- **Languages tested:** English and Hindi-English (Hinglish) dictation. Replies are written in English.
- **No persistent storage.** Demo data lives in one browser (Reset demo clears it); live mode keeps nothing after you close the tab.
- **Live inbox scope:** the 15 most recent inbox threads, excluding Promotions, Social and Forums; plain-text bodies only (no attachments).
- **Model output varies.** Wording and occasional coverage calls differ between runs; the "What I understood" panel is there so you can check before sending.

## Tech stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · shadcn/ui on Base UI · motion · lucide-react · Zustand · zod · Google Gemini via `@google/genai` · Auth.js (next-auth) · Gmail and Google Calendar REST APIs · Duffel API · Upstash Redis and Ratelimit · date-fns · Vitest · Playwright · Vercel

Design decisions and trade-offs are logged in [DECISIONS.md](DECISIONS.md). The demo video shot list is in [DEMO_SCRIPT.md](DEMO_SCRIPT.md).

## License

[MIT](LICENSE)

## Acknowledgements

Built for **No Hands: The Wispr Challenge**, and designed around dictation with [Wispr Flow](https://wisprflow.ai). Sayso is an independent project and is not affiliated with Wispr. Thanks to the teams behind Next.js, Google Gemini, Duffel, Upstash and the open-source libraries listed above. All people and companies in the demo inbox are fictional.
