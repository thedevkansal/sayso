import { z } from "zod";

/* ---------- Limits (public endpoint hardening) ---------- */
export const LIMITS = {
  messageBody: 8_000,
  messagesPerThread: 12,
  transcript: 4_000,
  subject: 300,
  name: 120,
};

/* ---------- Inbound data ---------- */
export const MessageSchema = z.object({
  id: z.string().max(100),
  from: z.object({ name: z.string().max(LIMITS.name), email: z.string().max(200) }),
  to: z.array(z.object({ name: z.string().max(LIMITS.name), email: z.string().max(200) })).max(20),
  date: z.string().max(40),
  body: z.string().max(LIMITS.messageBody),
});
export type Message = z.infer<typeof MessageSchema>;

export const ThreadSchema = z.object({
  id: z.string().max(100),
  subject: z.string().max(LIMITS.subject),
  messages: z.array(MessageSchema).min(1).max(LIMITS.messagesPerThread),
});
export type Thread = z.infer<typeof ThreadSchema>;

export const UserProfileSchema = z.object({
  name: z.string().max(LIMITS.name),
  email: z.string().max(200),
  role: z.string().max(LIMITS.name).optional(),
  homeCity: z.string().max(LIMITS.name).optional(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

/* ---------- Step 1: analyzeThread ---------- */
export const AskKind = z.enum(["info", "scheduling", "logistics", "confirmation", "travel"]);

export const AskSchema = z.object({
  id: z.string().describe("Short stable id like a1, a2"),
  kind: AskKind,
  text: z.string().describe("The question rewritten as a short plain question, max 12 words"),
  quote: z.string().describe("The exact words from the email that make this ask"),
  dueBy: z.string().nullable().describe("Deadline mentioned for this ask, as written, or null"),
});
export type Ask = z.infer<typeof AskSchema>;

export const AnalysisSchema = z.object({
  asks: z.array(AskSchema).max(12),
  suspicious: z.object({
    flagged: z.boolean().describe("True if the email contains instructions aimed at an AI or assistant"),
    reason: z.string().nullable(),
  }),
  summary: z.string().describe("One sentence on what the sender wants"),
});
export type Analysis = z.infer<typeof AnalysisSchema>;

/* ---------- Step 2: buildProposal ---------- */
export const FactSchema = z.object({
  phrase: z.string().describe("The exact words from the user's dictation this fact came from"),
  fact: z.string().describe("The fact as a short clean statement with absolute dates"),
  askId: z.string().nullable().describe("Which ask this answers, or null"),
  kind: z.enum(["answer", "correction", "private", "instruction", "uncertain"]),
});
export type Fact = z.infer<typeof FactSchema>;

export const CoverageSchema = z.object({
  askId: z.string(),
  status: z.enum(["answered", "partial", "missing"]),
  answer: z.string().nullable(),
});
export type Coverage = z.infer<typeof CoverageSchema>;

export const CalendarActionSchema = z.object({
  type: z.literal("calendar_event"),
  title: z.string(),
  date: z.string().describe("YYYY-MM-DD in the user's timezone"),
  startTime: z.string().describe("HH:mm 24h in the user's timezone"),
  durationMinutes: z.number().int().min(5).max(600),
  attendees: z.array(z.string()).describe("Email addresses from the thread"),
  sourceQuote: z.string().describe("Exact words from the user's dictation that asked for this"),
});

export const TravelActionSchema = z.object({
  type: z.literal("travel_search"),
  mode: z.enum(["flight", "train"]),
  origin: z.string().describe("City name"),
  originCode: z.string().nullable().describe("IATA code if known"),
  destination: z.string(),
  destinationCode: z.string().nullable(),
  date: z.string().describe("YYYY-MM-DD"),
  timeOfDay: z.enum(["morning", "afternoon", "evening", "any"]),
  passengers: z.number().int().min(1).max(9),
  sourceQuote: z.string(),
});

// Gemini's schema subset handles a flat object best, so the model fills one shape
// and we narrow it to the right action type afterwards.
export const RawActionSchema = z.object({
  type: z.enum(["calendar_event", "travel_search"]),
  title: z.string().nullable(),
  date: z.string(),
  startTime: z.string().nullable(),
  durationMinutes: z.number().int().nullable(),
  attendees: z.array(z.string()).nullable(),
  mode: z.enum(["flight", "train"]).nullable(),
  origin: z.string().nullable(),
  originCode: z.string().nullable(),
  destination: z.string().nullable(),
  destinationCode: z.string().nullable(),
  timeOfDay: z.enum(["morning", "afternoon", "evening", "any"]).nullable(),
  passengers: z.number().int().nullable(),
  sourceQuote: z.string(),
});
export type RawAction = z.infer<typeof RawActionSchema>;

export const ProposalCoreSchema = z.object({
  understoodFacts: z.array(FactSchema).max(20),
  coverage: z.array(CoverageSchema).max(12),
  gaps: z.array(z.string()).max(12).describe("Plain questions the user still has not answered"),
  replySubject: z.string(),
  actions: z.array(RawActionSchema).max(6),
});
export type ProposalCore = z.infer<typeof ProposalCoreSchema>;

export type CalendarAction = z.infer<typeof CalendarActionSchema> & { id: string; startISO: string; endISO: string };
export type TravelAction = z.infer<typeof TravelActionSchema> & { id: string };
export type Action = CalendarAction | TravelAction;

export type Proposal = {
  understoodFacts: (Fact & { verified: boolean })[];
  coverage: Coverage[];
  gaps: string[];
  reply: { subject: string; body: string };
  actions: Action[];
  dropped: { reason: string; quote: string }[];
};

/* ---------- API request bodies ---------- */
export const AnalyzeRequestSchema = z.object({ thread: ThreadSchema });

export const ProposeRequestSchema = z.object({
  thread: ThreadSchema,
  asks: z.array(AskSchema).max(12),
  transcript: z.string().trim().min(1).max(LIMITS.transcript),
  now: z.string().max(40),
  tz: z.string().max(60),
  user: UserProfileSchema,
});
export type ProposeRequest = z.infer<typeof ProposeRequestSchema>;
