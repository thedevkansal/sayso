"use client";

import { addDays } from "date-fns";
import type { Thread } from "@/lib/schemas";
import type { CalendarEvent, InboxThread } from "@/lib/seed";
import type { AppStore, ProposalState, SentItem } from "@/lib/store/demo";

function toThread(t: Thread): Thread {
  return { id: t.id, subject: t.subject, messages: t.messages };
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function errorOf(res: Response) {
  const body = await res.json().catch(() => null);
  return new ApiError(
    (body && typeof body.message === "string" && body.message) || "Something went wrong. Try again.",
    body?.error,
  );
}

/**
 * fetch for live endpoints. A stale Google token answers `token_expired`; hitting
 * /api/auth/session runs the refresh in auth.ts and rewrites the cookie, then we retry once.
 */
export async function liveFetch(url: string, init?: RequestInit): Promise<Response> {
  let res = await fetch(url, init);
  if (res.status === 401) {
    const err = await res.clone().json().catch(() => null);
    if (err?.error === "token_expired") {
      await fetch("/api/auth/session", { cache: "no-store" });
      res = await fetch(url, init);
    }
  }
  return res;
}

/* ---------------- Live: inbox, thread, calendar ---------------- */

export async function loadInbox(api: AppStore) {
  api.setState({ inbox: { status: "loading" } });
  try {
    const res = await liveFetch("/api/live/threads", { cache: "no-store" });
    if (!res.ok) throw await errorOf(res);
    const data: {
      threads: {
        id: string;
        subject: string;
        from: { name: string; email: string };
        date: string;
        preview: string;
        unread: boolean;
        starred: boolean;
      }[];
      me: { email: string; name: string };
    } = await res.json();
    const prev = api.getState().threads;
    const threads: InboxThread[] = data.threads.map((t) => {
      const existing = prev.find((p) => p.id === t.id);
      return (
        existing ?? {
          id: t.id,
          subject: t.subject,
          preview: t.preview,
          unread: t.unread,
          starred: t.starred,
          tag: null,
          // Placeholder so the inbox can render sender and time before the full thread loads.
          messages: [{ id: `${t.id}-head`, from: t.from, to: [], date: t.date, body: "" }],
        }
      );
    });
    api.setState({
      threads,
      inbox: { status: "ready" },
      user: { name: data.me.name || data.me.email, email: data.me.email },
    });
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError("Couldn't load your inbox.");
    api.setState({ inbox: { status: "error", message: err.message, code: err.code } });
  }
}

const threadLoads = new Map<string, Promise<boolean>>();

/** Live mode: fetch the full thread on first open. Demo threads are already complete. */
export function ensureThread(api: AppStore, threadId: string): Promise<boolean> {
  const s = api.getState();
  if (s.mode === "demo" || s.loadedThreads[threadId] === "ready") return Promise.resolve(true);
  const existing = threadLoads.get(threadId);
  if (existing) return existing;
  api.setState((st) => ({ loadedThreads: { ...st.loadedThreads, [threadId]: "loading" } }));
  const p = (async () => {
    try {
      const res = await liveFetch(`/api/live/threads/${threadId}`, { cache: "no-store" });
      if (!res.ok) throw await errorOf(res);
      const data: { thread: Thread; reply: { replyTo: { name: string; email: string }; subject: string } } =
        await res.json();
      api.setState((st) => ({
        threads: st.threads.map((t) => (t.id === threadId ? { ...t, subject: data.thread.subject, messages: data.thread.messages } : t)),
        replyMeta: { ...st.replyMeta, [threadId]: data.reply },
        loadedThreads: { ...st.loadedThreads, [threadId]: "ready" },
      }));
      return true;
    } catch (e) {
      api.setState((st) => ({
        loadedThreads: { ...st.loadedThreads, [threadId]: "error" },
        analyses: {
          ...st.analyses,
          [threadId]: { status: "error", message: e instanceof Error ? e.message : "Couldn't open this thread." },
        },
      }));
      return false;
    } finally {
      threadLoads.delete(threadId);
    }
  })();
  threadLoads.set(threadId, p);
  return p;
}

export async function loadCalendar(api: AppStore) {
  const from = addDays(new Date(), -1).toISOString();
  const to = addDays(new Date(), 30).toISOString();
  try {
    const res = await liveFetch(`/api/live/calendar?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data: { events: { id: string; title: string; startISO: string; endISO: string }[] } = await res.json();
    api.setState((st) => ({
      events: [
        ...data.events.map((e): CalendarEvent => ({ ...e, source: "seed" })),
        // Keep events Sayso just created until Google's list includes them.
        ...st.events.filter((e) => e.source === "sayso" && !data.events.some((g) => g.id === e.id)),
      ],
    }));
  } catch {
    /* calendar is best-effort; conflicts just won't show */
  }
}

/* ---------------- Side effects behind confirm cards ---------------- */

/** Sends the confirmed reply. Demo: in-app Sent only. Live: Gmail, in-thread. */
export async function sendReply(api: AppStore, threadId: string): Promise<SentItem> {
  const s = api.getState();
  const thread = s.threads.find((t) => t.id === threadId);
  const p = s.proposals[threadId];
  if (!thread || !p || !p.replyBody.trim()) throw new ApiError("Nothing to send yet.");
  const to = s.mode === "live" ? s.replyMeta[threadId]?.replyTo.email : thread.messages.at(-1)!.from.email;
  if (!to) throw new ApiError("Couldn't work out who to reply to.");

  if (s.mode === "live") {
    const res = await liveFetch("/api/live/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ threadId, to, subject: p.replySubject, body: p.replyBody }),
    });
    if (!res.ok) throw await errorOf(res);
  }
  const item: SentItem = {
    id: `sent-${Date.now()}`,
    threadId,
    to: [to],
    subject: p.replySubject,
    body: p.replyBody,
    sentAt: new Date().toISOString(),
  };
  api.getState().recordSent(item);
  return item;
}

/** Books a confirmed calendar event. Live: Google Calendar with invites to attendees. */
export async function bookEvent(
  api: AppStore,
  ev: { id: string; title: string; startISO: string; endISO: string; attendees: string[] },
): Promise<{ htmlLink?: string | null }> {
  const s = api.getState();
  let htmlLink: string | null = null;
  let id = ev.id;
  if (s.mode === "live") {
    const res = await liveFetch("/api/live/calendar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: ev.title, startISO: ev.startISO, endISO: ev.endISO, attendees: ev.attendees, tz: s.tz }),
    });
    if (!res.ok) throw await errorOf(res);
    const data = await res.json();
    htmlLink = data.htmlLink;
    id = data.id ?? id;
  }
  api.getState().addEvent({ id, title: ev.title, startISO: ev.startISO, endISO: ev.endISO, source: "sayso", attendees: ev.attendees });
  return { htmlLink };
}

/* ---------------- LLM pipeline ---------------- */

const inflight = new Map<string, Promise<void>>();

export function analyze(api: AppStore, threadId: string, { force = false } = {}) {
  const s = api.getState();
  const existing = s.analyses[threadId];
  const key = `${s.mode}:${threadId}`;
  if (!force && existing && existing.status !== "error") return inflight.get(key) ?? Promise.resolve();

  s.setAnalysis(threadId, { status: "loading" });
  const p = (async () => {
    try {
      if (!(await ensureThread(api, threadId))) return;
      const thread = api.getState().threads.find((t) => t.id === threadId);
      if (!thread) return;
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ thread: toThread(thread) }),
      });
      if (!res.ok) throw await errorOf(res);
      const data = await res.json();
      api.getState().setAnalysis(threadId, { status: "ready", ...data });
    } catch (e) {
      api.getState().setAnalysis(threadId, {
        status: "error",
        message: e instanceof Error ? e.message : "Couldn't read this thread.",
      });
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

const controllers = new Map<string, AbortController>();

export async function propose(api: AppStore, threadId: string) {
  const transcript = (api.getState().transcripts[threadId] ?? "").trim();
  if (!transcript) return;

  const key = `${api.getState().mode}:${threadId}`;
  controllers.get(key)?.abort();
  const ctrl = new AbortController();
  controllers.set(key, ctrl);

  const base: ProposalState = {
    status: "thinking",
    understoodFacts: [],
    coverage: [],
    gaps: [],
    replySubject: "",
    replyBody: "",
    actions: [],
    dropped: [],
    basedOn: transcript,
  };
  // Show progress right away; the user may hit draft while the thread is still being read.
  api.getState().setProposal(threadId, base);
  await analyze(api, threadId);
  if (ctrl.signal.aborted) return;

  const s = api.getState();
  const thread = s.threads.find((t) => t.id === threadId);
  const analysis = s.analyses[threadId];
  if (!thread || analysis?.status !== "ready") {
    s.setProposal(threadId, { ...base, status: "error", error: "Couldn't read this thread yet. Try again in a moment." });
    return;
  }

  // A new proposal replaces old action ids; clear their statuses for this thread.
  api.setState((st) => ({
    actionStatus: Object.fromEntries(
      Object.entries(st.actionStatus).filter(([k]) => !k.startsWith(`${threadId}:`) || k.endsWith(":send")),
    ),
  }));

  const update = (fn: (p: ProposalState) => ProposalState) =>
    api.getState().setProposal(threadId, (prev) => fn(prev ?? base));

  try {
    const res = await fetch("/api/propose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        thread: toThread(thread),
        asks: analysis.asks,
        transcript,
        now: new Date().toISOString(),
        tz: s.tz,
        user: s.user,
      }),
    });
    if (!res.ok || !res.body) throw await errorOf(res);

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += value;
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        const ev = JSON.parse(line);
        if (ev.type === "core") {
          update((p) => ({
            ...p,
            status: "drafting",
            understoodFacts: ev.understoodFacts,
            coverage: ev.coverage,
            gaps: ev.gaps,
            replySubject: s.mode === "live" ? (s.replyMeta[threadId]?.subject ?? ev.replySubject) : ev.replySubject,
            actions: ev.actions,
            dropped: ev.dropped,
          }));
        } else if (ev.type === "delta") {
          update((p) => ({ ...p, replyBody: p.replyBody + ev.text }));
        } else if (ev.type === "done") {
          update((p) => ({ ...p, status: "ready", replyBody: p.replyBody.trim() }));
        } else if (ev.type === "error") {
          throw new Error(ev.message);
        }
      }
    }
  } catch (e) {
    if (ctrl.signal.aborted) return;
    update((p) => ({ ...p, status: "error", error: e instanceof Error ? e.message : "Couldn't draft a reply." }));
  } finally {
    if (controllers.get(key) === ctrl) controllers.delete(key);
  }
}
