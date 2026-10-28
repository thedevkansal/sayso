"use client";

import type { Thread } from "@/lib/schemas";
import { useDemo, type ProposalState } from "@/lib/store/demo";

function toThread(t: Thread): Thread {
  return { id: t.id, subject: t.subject, messages: t.messages };
}

async function errorMessage(res: Response) {
  const body = await res.json().catch(() => null);
  return (body && typeof body.message === "string" && body.message) || "Something went wrong. Try again.";
}

const inflight = new Map<string, Promise<void>>();

export function analyze(threadId: string, { force = false } = {}) {
  const s = useDemo.getState();
  const existing = s.analyses[threadId];
  if (!force && existing && existing.status !== "error") return inflight.get(threadId) ?? Promise.resolve();
  const thread = s.threads.find((t) => t.id === threadId);
  if (!thread) return Promise.resolve();

  s.setAnalysis(threadId, { status: "loading" });
  const p = (async () => {
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ thread: toThread(thread) }),
      });
      if (!res.ok) throw new Error(await errorMessage(res));
      const data = await res.json();
      useDemo.getState().setAnalysis(threadId, { status: "ready", ...data });
    } catch (e) {
      useDemo.getState().setAnalysis(threadId, {
        status: "error",
        message: e instanceof Error ? e.message : "Couldn't read this thread.",
      });
    } finally {
      inflight.delete(threadId);
    }
  })();
  inflight.set(threadId, p);
  return p;
}

const controllers = new Map<string, AbortController>();

export async function propose(threadId: string) {
  const transcript = (useDemo.getState().transcripts[threadId] ?? "").trim();
  if (!transcript) return;

  controllers.get(threadId)?.abort();
  const ctrl = new AbortController();
  controllers.set(threadId, ctrl);

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
  useDemo.getState().setProposal(threadId, base);
  await analyze(threadId);
  if (ctrl.signal.aborted) return;

  const s = useDemo.getState();
  const thread = s.threads.find((t) => t.id === threadId);
  const analysis = s.analyses[threadId];
  if (!thread || analysis?.status !== "ready") {
    s.setProposal(threadId, { ...base, status: "error", error: "Couldn't read this thread yet. Try again in a moment." });
    return;
  }
  // A new proposal replaces old action ids; clear their statuses for this thread.
  useDemo.setState((st) => ({
    actionStatus: Object.fromEntries(
      Object.entries(st.actionStatus).filter(([k]) => !k.startsWith(`${threadId}:`) || k.endsWith(":send")),
    ),
  }));

  const update = (fn: (p: ProposalState) => ProposalState) =>
    useDemo.getState().setProposal(threadId, (prev) => fn(prev ?? base));

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
    if (!res.ok || !res.body) throw new Error(await errorMessage(res));

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
            replySubject: ev.replySubject,
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
    if (controllers.get(threadId) === ctrl) controllers.delete(threadId);
  }
}
