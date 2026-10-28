"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Action, Ask, Coverage, Fact, UserProfile } from "@/lib/schemas";
import { buildSeed, type CalendarEvent, type InboxThread } from "@/lib/seed";
import { DEFAULT_TZ } from "@/lib/dates";

export type AnalysisState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; asks: Ask[]; summary: string; suspicious: { flagged: boolean; reason: string | null } };

export type ProposalState = {
  status: "thinking" | "drafting" | "ready" | "error";
  error?: string;
  understoodFacts: (Fact & { verified: boolean })[];
  coverage: Coverage[];
  gaps: string[];
  replySubject: string;
  replyBody: string;
  actions: Action[];
  dropped: { reason: string; quote: string }[];
  /** Transcript the proposal was built from, to show "out of date" when the user keeps talking. */
  basedOn: string;
};

export type ActionStatus = "pending" | "done" | "dismissed";

export type SentItem = {
  id: string;
  threadId: string;
  to: string[];
  subject: string;
  body: string;
  sentAt: string;
};

export type Booking = {
  id: string;
  threadId: string;
  summary: string;
  reference: string;
  createdAt: string;
};

type State = {
  version: number;
  seededAt: string;
  tz: string;
  user: UserProfile;
  threads: InboxThread[];
  events: CalendarEvent[];
  sent: SentItem[];
  bookings: Booking[];
  selectedId: string | null;
  transcripts: Record<string, string>;
  analyses: Record<string, AnalysisState>;
  proposals: Record<string, ProposalState>;
  actionStatus: Record<string, ActionStatus>;
};

type Api = {
  select: (id: string | null) => void;
  setTranscript: (id: string, text: string) => void;
  setAnalysis: (id: string, a: AnalysisState) => void;
  setProposal: (id: string, p: ProposalState | ((prev: ProposalState | undefined) => ProposalState)) => void;
  setReplyBody: (id: string, body: string) => void;
  setActionStatus: (key: string, s: ActionStatus) => void;
  addEvent: (e: CalendarEvent) => void;
  sendReply: (threadId: string) => SentItem | null;
  addBooking: (b: Booking) => void;
  reset: () => void;
};

const STORE_VERSION = 1;

function fresh(): State {
  const seed = buildSeed(new Date(), DEFAULT_TZ);
  return {
    version: STORE_VERSION,
    seededAt: new Date().toISOString(),
    tz: seed.tz,
    user: seed.user,
    threads: seed.threads,
    events: seed.events,
    sent: [],
    bookings: [],
    selectedId: null,
    transcripts: {},
    analyses: {},
    proposals: {},
    actionStatus: {},
  };
}

export const useDemo = create<State & Api>()(
  persist(
    (set, get) => ({
      ...fresh(),
      select: (id) =>
        set((s) => ({
          selectedId: id,
          threads: id ? s.threads.map((t) => (t.id === id ? { ...t, unread: false } : t)) : s.threads,
        })),
      setTranscript: (id, text) => set((s) => ({ transcripts: { ...s.transcripts, [id]: text } })),
      setAnalysis: (id, a) => set((s) => ({ analyses: { ...s.analyses, [id]: a } })),
      setProposal: (id, p) =>
        set((s) => ({
          proposals: { ...s.proposals, [id]: typeof p === "function" ? p(s.proposals[id]) : p },
        })),
      setReplyBody: (id, body) =>
        set((s) => (s.proposals[id] ? { proposals: { ...s.proposals, [id]: { ...s.proposals[id], replyBody: body } } } : s)),
      setActionStatus: (key, st) => set((s) => ({ actionStatus: { ...s.actionStatus, [key]: st } })),
      addEvent: (e) => set((s) => ({ events: [...s.events, e] })),
      addBooking: (b) => set((s) => ({ bookings: [b, ...s.bookings] })),
      sendReply: (threadId) => {
        const s = get();
        const thread = s.threads.find((t) => t.id === threadId);
        const p = s.proposals[threadId];
        if (!thread || !p || !p.replyBody.trim()) return null;
        const last = thread.messages.at(-1)!;
        const item: SentItem = {
          id: `sent-${Date.now()}`,
          threadId,
          to: [last.from.email],
          subject: p.replySubject,
          body: p.replyBody,
          sentAt: new Date().toISOString(),
        };
        set({
          sent: [item, ...s.sent],
          actionStatus: { ...s.actionStatus, [`${threadId}:send`]: "done" },
        });
        return item;
      },
      reset: () => set({ ...fresh() }),
    }),
    {
      name: "sayso-demo",
      version: STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Don't persist in-flight states; a reload mid-stream should come back clean.
      partialize: (s) => ({
        ...s,
        analyses: Object.fromEntries(Object.entries(s.analyses).filter(([, a]) => a.status === "ready")),
        proposals: Object.fromEntries(Object.entries(s.proposals).filter(([, p]) => p.status === "ready")),
      }),
      migrate: () => fresh(),
      skipHydration: true,
    },
  ),
);

export const actionKey = (threadId: string, actionId: string) => `${threadId}:${actionId}`;
