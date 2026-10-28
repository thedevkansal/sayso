"use client";

import { createContext, useContext } from "react";
import { create, useStore, type StoreApi } from "zustand";
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

export type Mode = "demo" | "live";

/** Live mode: who a reply goes to, resolved server-side from the thread's headers. */
export type ReplyMeta = { replyTo: { name: string; email: string }; subject: string };

export type InboxStatus = { status: "idle" | "loading" | "ready" } | { status: "error"; message: string; code?: string };

type State = {
  mode: Mode;
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
  /** Live mode only. */
  inbox: InboxStatus;
  loadedThreads: Record<string, "loading" | "ready" | "error">;
  replyMeta: Record<string, ReplyMeta>;
};

type Api = {
  select: (id: string | null) => void;
  setTranscript: (id: string, text: string) => void;
  setAnalysis: (id: string, a: AnalysisState) => void;
  setProposal: (id: string, p: ProposalState | ((prev: ProposalState | undefined) => ProposalState)) => void;
  setReplyBody: (id: string, body: string) => void;
  setActionStatus: (key: string, s: ActionStatus) => void;
  addEvent: (e: CalendarEvent) => void;
  recordSent: (item: SentItem) => void;
  addBooking: (b: Booking) => void;
  reset: () => void;
};

export type AppState = State & Api;
export type AppStore = StoreApi<AppState>;

const STORE_VERSION = 2;

function freshDemo(): State {
  const seed = buildSeed(new Date(), DEFAULT_TZ);
  return {
    mode: "demo",
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
    inbox: { status: "ready" },
    loadedThreads: {},
    replyMeta: {},
  };
}

function freshLive(): State {
  const tz =
    typeof Intl !== "undefined" ? (Intl.DateTimeFormat().resolvedOptions().timeZone ?? DEFAULT_TZ) : DEFAULT_TZ;
  return {
    ...freshDemo(),
    mode: "live",
    tz,
    user: { name: "", email: "" },
    threads: [],
    events: [],
    inbox: { status: "idle" },
  };
}

function actions(set: StoreApi<AppState>["setState"], fresh: () => State): Api {
  return {
    select: (id) =>
      set((s) => ({
        selectedId: id,
        threads: id ? s.threads.map((t) => (t.id === id ? { ...t, unread: false } : t)) : s.threads,
      })),
    setTranscript: (id, text) => set((s) => ({ transcripts: { ...s.transcripts, [id]: text } })),
    setAnalysis: (id, a) => set((s) => ({ analyses: { ...s.analyses, [id]: a } })),
    setProposal: (id, p) =>
      set((s) => ({ proposals: { ...s.proposals, [id]: typeof p === "function" ? p(s.proposals[id]) : p } })),
    setReplyBody: (id, body) =>
      set((s) => (s.proposals[id] ? { proposals: { ...s.proposals, [id]: { ...s.proposals[id], replyBody: body } } } : s)),
    setActionStatus: (key, st) => set((s) => ({ actionStatus: { ...s.actionStatus, [key]: st } })),
    addEvent: (e) => set((s) => ({ events: [...s.events.filter((x) => x.id !== e.id), e] })),
    addBooking: (b) => set((s) => ({ bookings: [b, ...s.bookings] })),
    recordSent: (item) =>
      set((s) => ({
        sent: [item, ...s.sent],
        actionStatus: { ...s.actionStatus, [`${item.threadId}:send`]: "done" },
      })),
    reset: () => set({ ...fresh() }),
  };
}

/** Demo: seeded fictional data, persisted in this browser. */
export const useDemo = create<AppState>()(
  persist((set) => ({ ...freshDemo(), ...actions(set, freshDemo) }), {
    name: "sayso-demo",
    version: STORE_VERSION,
    storage: createJSONStorage(() => localStorage),
    // Don't persist in-flight states; a reload mid-stream should come back clean.
    partialize: (s) => ({
      ...s,
      analyses: Object.fromEntries(Object.entries(s.analyses).filter(([, a]) => a.status === "ready")),
      proposals: Object.fromEntries(Object.entries(s.proposals).filter(([, p]) => p.status === "ready")),
    }),
    migrate: () => freshDemo(),
    skipHydration: true,
  }),
);

/** Live: real Gmail and Calendar data, kept in memory only. Email content is never written to storage. */
export const useLive = create<AppState>()((set) => ({ ...freshLive(), ...actions(set, freshLive) }));

export const AppStoreContext = createContext<AppStore>(useDemo);

/** Select from whichever store (demo or live) this part of the tree is using. */
export function useApp<T>(selector: (s: AppState) => T): T {
  return useStore(useContext(AppStoreContext), selector);
}

export function useAppApi(): AppStore {
  return useContext(AppStoreContext);
}

export const actionKey = (threadId: string, actionId: string) => `${threadId}:${actionId}`;
