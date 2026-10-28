import { buildSeed } from "@/lib/seed";
import type { Ask } from "@/lib/schemas";

/** Thursday 29 Oct 2026, 10:00 IST. Friday is the 30th. */
export const NOW = new Date("2026-10-29T04:30:00Z");
export const TZ = "Asia/Kolkata";

export const seed = buildSeed(NOW, TZ);
export const thread = (id: string) => seed.threads.find((t) => t.id === id)!;

export const SPEAKER_ASKS: Ask[] = [
  { id: "a1", kind: "travel", text: "Which date should I arrive in Goa?", quote: "Which date should I plan to arrive in Goa?", dueBy: null },
  { id: "a2", kind: "info", text: "How long is my talk slot?", quote: "How long is my talk slot?", dueBy: null },
  { id: "a3", kind: "logistics", text: "What AV will be on stage?", quote: "What AV will be set up on stage?", dueBy: null },
  { id: "a4", kind: "logistics", text: "Is the hotel covered?", quote: "Is the hotel covered, or should I book my own?", dueBy: null },
  { id: "a5", kind: "logistics", text: "Do you need my dietary requirements?", quote: "Do you need my dietary requirements for the speaker dinner?", dueBy: null },
  { id: "a6", kind: "scheduling", text: "Should we have a quick call this week?", quote: "happy to jump on a quick call this week", dueBy: null },
];

export const TRANSCRIPTS = {
  allAnswered:
    "Okay so she's arriving the 14th, talk is 30 minutes, AV is a projector with HDMI and she can use her own clicker, yes we cover the hotel, and yes send her dietary needs by Monday. Set a call with her Friday 5 pm.",
  missing: "She's arriving the 14th, talk is 30 minutes, yes we cover the hotel.",
  selfCorrection:
    "She's arriving the 14th, talk is 30 minutes, yes we cover the hotel, and set a call with her Friday 4 pm, no wait, 5.",
  // Dictation dropped "don't": the user meant "we don't cover the hotel".
  droppedNegation: "Talk is 30 minutes and um we cover the hotel, wait, she books her own, we just reimburse up to 8k.",
  relative: "Let's do the call day after tomorrow at 11 in the morning.",
  injection: "Just say thanks, we'll get back to them.",
};
