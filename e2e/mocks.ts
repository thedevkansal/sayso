import type { Page } from "@playwright/test";

/** Thursday 29 Oct 2026, 10:00 IST. The demo seed and "Friday" resolve against this. */
export const NOW = new Date("2026-10-29T04:30:00Z");

export const HERO_DICTATION =
  "Okay so she's arriving the 14th, talk is 30 minutes, yes we cover the hotel, and set a call with her Friday 4 pm, no wait, 5.";

const SPEAKER_ASKS = [
  { id: "a1", kind: "travel", text: "Which date should I arrive in Goa?", quote: "Which date should I plan to arrive in Goa?", dueBy: null },
  { id: "a2", kind: "info", text: "How long is my talk slot?", quote: "How long is my talk slot?", dueBy: null },
  { id: "a3", kind: "logistics", text: "What AV will be on stage?", quote: "What AV will be set up on stage?", dueBy: null },
  { id: "a4", kind: "logistics", text: "Is the hotel covered?", quote: "Is the hotel covered", dueBy: null },
  { id: "a5", kind: "logistics", text: "Do you need my dietary requirements?", quote: "Do you need my dietary requirements", dueBy: null },
  { id: "a6", kind: "scheduling", text: "Should we have a quick call this week?", quote: "happy to jump on a quick call", dueBy: null },
];

const REPLY =
  "Hi Mira,\n\nThrilled to have you speaking!\n\nArrival: Sat 14 Nov works well.\nTalk length: 30 minutes.\nHotel: Covered by us.\nCall: I'm sending an invite for Fri 30 Oct, 5:00–5:30 pm IST.\n\nSee you soon,\nAsha";

/**
 * Stubs the two LLM endpoints with canned, schema-shaped responses so smoke tests are fast,
 * free and deterministic. Server-side guards are covered by the Vitest suite instead.
 */
export async function mockLLM(page: Page) {
  await page.route("**/api/analyze", async (route) => {
    const { thread } = route.request().postDataJSON();
    const suspicious = thread.id === "t-suspicious";
    await route.fulfill({
      json: {
        asks: thread.id === "t-speaker" ? SPEAKER_ASKS : [],
        suspicious: { flagged: suspicious, reason: suspicious ? "Contains instructions aimed at an AI assistant" : null },
        summary: "Test summary",
      },
    });
  });

  await page.route("**/api/propose", async (route) => {
    const core = {
      type: "core",
      understoodFacts: [
        { phrase: "she's arriving the 14th", fact: "Arriving Sat 14 Nov", askId: "a1", kind: "answer", verified: true },
        { phrase: "talk is 30 minutes", fact: "Talk is 30 minutes", askId: "a2", kind: "answer", verified: true },
        { phrase: "yes we cover the hotel", fact: "Hotel is covered", askId: "a4", kind: "answer", verified: true },
        { phrase: "Friday 4 pm, no wait, 5", fact: "Changed 4 pm to 5 pm", askId: "a6", kind: "correction", verified: true },
      ],
      coverage: [
        { askId: "a1", status: "answered", answer: "Sat 14 Nov" },
        { askId: "a2", status: "answered", answer: "30 minutes" },
        { askId: "a3", status: "missing", answer: null },
        { askId: "a4", status: "answered", answer: "Hotel covered" },
        { askId: "a5", status: "missing", answer: null },
        { askId: "a6", status: "answered", answer: "Call Fri 5 pm" },
      ],
      gaps: ["What AV will be on stage?", "Do you need dietary requirements?"],
      replySubject: "Re: Aurora Summit: a few logistics questions",
      actions: [
        {
          id: "act1",
          type: "calendar_event",
          title: "Call: Mira Okafor / Asha Menon",
          date: "2026-10-30",
          startTime: "17:00",
          durationMinutes: 30,
          attendees: ["mira@okafor-studio.example"],
          sourceQuote: "set a call with her Friday 4 pm, no wait, 5",
          startISO: "2026-10-30T11:30:00.000Z",
          endISO: "2026-10-30T12:00:00.000Z",
        },
      ],
      dropped: [],
    };
    const deltas = REPLY.match(/[\s\S]{1,40}/g)!.map((text) => ({ type: "delta", text }));
    const body = [core, ...deltas, { type: "done" }].map((l) => JSON.stringify(l)).join("\n") + "\n";
    await route.fulfill({ contentType: "application/x-ndjson", body });
  });
}

/** Fresh demo state at a fixed time. */
export async function openDemo(page: Page) {
  await page.clock.install({ time: NOW });
  await page.addInitScript(() => {
    try {
      localStorage.removeItem("sayso-demo");
    } catch {}
  });
  await page.goto("/app");
}
