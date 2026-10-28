import type { Thread } from "@/lib/schemas";

const INJECTION_PATTERNS = [
  /ignore (all |any )?(the )?(previous|prior|above) (instructions|prompts?)/i,
  /\b(ai|llm) (assistant|agent)\b.{0,40}\binstructions?\b/i,
  /\byou are now (in )?\w+ mode\b/i,
  /\bforward (the |this |your )?(whole|entire|full) (inbox|mailbox)\b/i,
  /\bdo not (tell|mention|inform)\b.{0,40}\buser\b/i,
  /\bsystem prompt\b/i,
];

/** Cheap, deterministic second opinion next to the model's own flag. */
export function detectInjection(thread: Thread): string | null {
  for (const m of thread.messages) {
    for (const p of INJECTION_PATTERNS) {
      if (p.test(m.body)) return "Contains instructions aimed at an AI assistant";
    }
  }
  return null;
}

const NEGATIONS = new Set([
  "not", "no", "never", "don't", "dont", "doesn't", "didn't", "won't", "can't", "cannot",
  "isn't", "aren't", "wasn't", "shouldn't", "nahi", "nahin", "mat", "na",
]);

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}'\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True if `quote` came from `source`: exact substring after normalising, or ≥80% of its words in order-insensitive overlap. */
export function traceable(quote: string, source: string) {
  const q = normalize(quote);
  const s = normalize(source);
  if (!q) return false;
  if (s.includes(q)) return true;
  const qWords = q.split(" ").filter((w) => w.length > 1);
  if (qWords.length < 2) return false;
  const sWords = new Set(s.split(" "));
  // A negation the user never said flips the meaning; that's never a fuzzy match.
  if (qWords.some((w) => NEGATIONS.has(w) && !sWords.has(w))) return false;
  const hit = qWords.filter((w) => sWords.has(w)).length;
  return hit / qWords.length >= 0.8;
}

export function threadParticipants(thread: Thread) {
  const set = new Set<string>();
  for (const m of thread.messages) {
    set.add(m.from.email.toLowerCase());
    for (const t of m.to) set.add(t.email.toLowerCase());
  }
  return set;
}
