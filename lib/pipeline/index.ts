import {
  AnalysisSchema,
  ProposalCoreSchema,
  type Action,
  type Analysis,
  type Ask,
  type Proposal,
  type RawAction,
  type Thread,
  type UserProfile,
} from "@/lib/schemas";
import { dayTable, formatRange, isValidLocalDate, isValidLocalTime, localDate, zonedToISO } from "@/lib/dates";
import { formatInTimeZone } from "date-fns-tz";
import type { LLM, Usage } from "@/lib/llm/types";
import { ANALYZE_SYSTEM, PROPOSE_SYSTEM, REPLY_SYSTEM, analyzePrompt, proposePrompt, replyPrompt } from "@/lib/llm/prompts";
import { detectInjection, threadParticipants, traceable } from "./guards";

export type AnalyzeResult = Analysis & { usage: Usage };

export async function analyzeThread(llm: LLM, thread: Thread): Promise<AnalyzeResult> {
  const { data, usage } = await llm.json({
    name: "analyzeThread",
    system: ANALYZE_SYSTEM,
    prompt: analyzePrompt(thread),
    schema: AnalysisSchema,
  });
  const heuristic = detectInjection(thread);
  const flagged = data.suspicious.flagged || Boolean(heuristic);
  // Ids must be unique and stable for coverage mapping.
  const asks = data.asks.map((a, i) => ({ ...a, id: `a${i + 1}` }));
  return {
    ...data,
    asks,
    suspicious: { flagged, reason: flagged ? (data.suspicious.reason ?? heuristic) : null },
    usage,
  };
}

export type ProposalCoreResult = Omit<Proposal, "reply"> & { replySubject: string; usage: Usage };

export async function buildProposalCore(
  llm: LLM,
  input: { thread: Thread; asks: Ask[]; transcript: string; now: Date; tz: string; user: UserProfile },
): Promise<ProposalCoreResult> {
  const { thread, asks, transcript, now, tz, user } = input;
  const { data, usage } = await llm.json({
    name: "buildProposal",
    system: PROPOSE_SYSTEM,
    prompt: proposePrompt({
      thread,
      asks,
      transcript,
      today: formatInTimeZone(now, tz, "EEEE yyyy-MM-dd HH:mm"),
      tz,
      dayTable: dayTable(now, tz),
      user,
    }),
    schema: ProposalCoreSchema,
  });

  const askIds = new Set(asks.map((a) => a.id));
  const coverage = asks.map(
    (a) =>
      data.coverage.find((c) => c.askId === a.id) ?? { askId: a.id, status: "missing" as const, answer: null },
  );

  const understoodFacts = data.understoodFacts.map((f) => ({
    ...f,
    askId: f.askId && askIds.has(f.askId) ? f.askId : null,
    verified: traceable(f.phrase, transcript),
  }));

  const participants = threadParticipants(thread);
  participants.delete(user.email.toLowerCase());
  const today = localDate(now, tz);

  const actions: Action[] = [];
  const dropped: Proposal["dropped"] = [];
  data.actions.forEach((raw, i) => {
    const res = narrowAction(raw, { transcript, tz, participants, today, user, id: `act${i + 1}` });
    if ("reason" in res) dropped.push({ reason: res.reason, quote: raw.sourceQuote });
    else actions.push(res);
  });

  return {
    understoodFacts,
    coverage,
    gaps: data.gaps,
    replySubject: data.replySubject,
    actions,
    dropped,
    usage,
  };
}

function narrowAction(
  raw: RawAction,
  ctx: { transcript: string; tz: string; participants: Set<string>; today: string; user: UserProfile; id: string },
): Action | { reason: string } {
  // Safety: an action must trace back to the user's own words.
  if (!traceable(raw.sourceQuote, ctx.transcript)) return { reason: "Not something you said" };
  if (!isValidLocalDate(raw.date)) return { reason: "Unclear date" };
  if (raw.date < ctx.today) return { reason: "Date is in the past" };

  if (raw.type === "calendar_event") {
    if (!raw.startTime || !isValidLocalTime(raw.startTime)) return { reason: "Unclear time" };
    const duration = raw.durationMinutes && raw.durationMinutes >= 5 && raw.durationMinutes <= 600 ? raw.durationMinutes : 30;
    const startISO = zonedToISO(raw.date, raw.startTime, ctx.tz);
    const endISO = new Date(new Date(startISO).getTime() + duration * 60_000).toISOString();
    const attendees = (raw.attendees ?? []).map((a) => a.toLowerCase().trim()).filter((a) => ctx.participants.has(a));
    return {
      id: ctx.id,
      type: "calendar_event",
      title: raw.title?.trim() || "Call",
      date: raw.date,
      startTime: raw.startTime,
      durationMinutes: duration,
      attendees,
      sourceQuote: raw.sourceQuote,
      startISO,
      endISO,
    };
  }

  if (!raw.destination) return { reason: "No destination" };
  return {
    id: ctx.id,
    type: "travel_search",
    mode: raw.mode ?? "flight",
    origin: raw.origin || ctx.user.homeCity || "",
    originCode: raw.originCode?.toUpperCase().slice(0, 3) ?? null,
    destination: raw.destination,
    destinationCode: raw.destinationCode?.toUpperCase().slice(0, 3) ?? null,
    date: raw.date,
    timeOfDay: raw.timeOfDay ?? "any",
    passengers: raw.passengers && raw.passengers > 0 && raw.passengers < 10 ? raw.passengers : 1,
    sourceQuote: raw.sourceQuote,
  };
}

/** Streams the reply body built strictly from the validated plan. */
export function streamReply(
  llm: LLM,
  input: { thread: Thread; asks: Ask[]; core: ProposalCoreResult; tz: string; user: UserProfile; onUsage?: (u: Usage) => void },
) {
  const { thread, asks, core, tz, user } = input;
  const answered = core.coverage
    .filter((c) => c.status !== "missing" && c.answer)
    .map((c) => ({ ask: asks.find((a) => a.id === c.askId)?.text ?? "", answer: c.answer! }));
  // Verified things the user wants said that don't map to an ask ("just say thanks").
  // Calendar/travel instructions are covered by `invites`/`travel` below.
  const extraFacts = core.understoodFacts
    .filter((f) => !f.askId && f.verified && (f.kind === "answer" || f.kind === "instruction"))
    .filter((f) => !core.actions.some((a) => traceable(a.sourceQuote, f.phrase) || traceable(f.phrase, a.sourceQuote)))
    .map((f) => f.fact);
  const invites = core.actions
    .filter((a) => a.type === "calendar_event")
    .map((a) => `${a.title}: ${formatRange(a.startISO, a.endISO, tz)}`);
  const travel = core.actions
    .filter((a) => a.type === "travel_search")
    .map((a) => `${a.mode} ${a.origin} to ${a.destination} on ${a.date}`);

  return llm.stream({
    system: REPLY_SYSTEM,
    prompt: replyPrompt({ thread, user, answered, extraFacts, invites, travel }),
    onUsage: input.onUsage,
  });
}
