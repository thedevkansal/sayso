"use client";

import { ArrowLeft, ShieldAlert } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import type { InboxThread } from "@/lib/seed";
import type { AnalysisState } from "@/lib/store/demo";
import { detectInjection } from "@/lib/pipeline/guards";
import { Avatar } from "./avatar";

export function ThreadView({
  thread,
  analysis,
  tz,
  onBack,
}: {
  thread: InboxThread;
  analysis?: AnalysisState;
  tz: string;
  onBack?: () => void;
}) {
  const heuristic = detectInjection(thread);
  const flagged = (analysis?.status === "ready" && analysis.suspicious.flagged) || Boolean(heuristic);
  const reason = (analysis?.status === "ready" && analysis.suspicious.reason) || heuristic;

  return (
    <article aria-labelledby="thread-subject">
      <div className="flex items-start gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 grid size-9 shrink-0 place-items-center rounded-full hover:bg-surface-2 lg:hidden"
            aria-label="Back to inbox"
          >
            <ArrowLeft className="size-4" />
          </button>
        )}
        <h1 id="thread-subject" className="text-title text-2xl text-balance text-ink sm:text-[1.75rem]">
          {thread.subject}
        </h1>
      </div>

      {flagged && (
        <div
          role="alert"
          className="mt-4 flex gap-3 rounded-2xl border border-risk/30 bg-risk-soft p-4 text-sm text-risk"
        >
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Suspicious email: instructions aimed at an AI were ignored</p>
            <p className="mt-1 leading-relaxed opacity-90">
              {reason ?? "This email tries to give orders to an assistant."} Sayso treats email text as data. Nothing
              in it can trigger a send, forward or payment. Only your own words can.
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 space-y-4">
        {thread.messages.map((m) => (
          <section key={m.id} className="rounded-3xl border border-line bg-surface p-5">
            <header className="flex items-center gap-3">
              <Avatar name={m.from.name} />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm font-medium text-ink">{m.from.name}</p>
                <p className="truncate text-xs text-mute">
                  {m.from.email} · to {m.to.map((t) => t.name).join(", ")}
                </p>
              </div>
              <time className="shrink-0 text-xs text-mute" dateTime={m.date} suppressHydrationWarning>
                {formatInTimeZone(new Date(m.date), tz, "EEE d MMM, h:mm a")}
              </time>
            </header>
            <div className="mt-4 text-[0.95rem] leading-relaxed whitespace-pre-line text-ink-2">{m.body}</div>
          </section>
        ))}
      </div>
    </article>
  );
}
