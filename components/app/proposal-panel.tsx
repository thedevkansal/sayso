"use client";

import { AnimatePresence, motion } from "motion/react";
import {
  AlertTriangle,
  Check,
  CircleAlert,
  CircleDashed,
  EyeOff,
  ListChecks,
  Mic,
  RotateCw,
  ShieldCheck,
  Undo2,
} from "lucide-react";
import type { Ask, Fact } from "@/lib/schemas";
import type { AnalysisState, ProposalState } from "@/lib/store/demo";
import { useApp } from "@/lib/store/demo";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CalendarCard, SendCard, TravelCard } from "./action-cards";

export function ProposalPanel({
  threadId,
  analysis,
  proposal,
  onRetryAnalysis,
  onRetryProposal,
  onAnswerGap,
}: {
  threadId: string;
  analysis?: AnalysisState;
  proposal?: ProposalState;
  onRetryAnalysis: () => void;
  onRetryProposal: () => void;
  onAnswerGap: () => void;
}) {
  if (!analysis || analysis.status === "loading") return <AsksSkeleton />;
  if (analysis.status === "error")
    return <ErrorBlock message={analysis.message} onRetry={onRetryAnalysis} label="Read the thread again" />;

  const asks = analysis.asks;
  if (!proposal) return <AskList asks={asks} flagged={analysis.suspicious.flagged} />;

  const thinking = proposal.status === "thinking";
  return (
    <div className="space-y-6">
      {proposal.status === "error" && (
        <ErrorBlock message={proposal.error ?? "Couldn't draft a reply."} onRetry={onRetryProposal} label="Try again" />
      )}

      {asks.length > 0 && (
        <Section title="Questions answered" icon={ListChecks} aside={!thinking ? <CoverageScore proposal={proposal} total={asks.length} /> : null}>
          {thinking ? <ListSkeleton rows={asks.length} /> : <CoverageList asks={asks} proposal={proposal} />}
        </Section>
      )}

      {!thinking && proposal.gaps.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-warn/35 bg-warn-soft p-4"
        >
          <p className="flex items-center gap-2 text-sm font-semibold text-warn">
            <CircleAlert className="size-4" /> You didn&apos;t answer {proposal.gaps.length === 1 ? "this" : "these"}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-ink">
            {proposal.gaps.map((g) => (
              <li key={g}>• {g}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={onAnswerGap}
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full border border-warn/40 bg-surface px-3.5 text-sm font-medium text-ink hover:bg-surface-2"
          >
            <Mic className="size-3.5" /> Add an answer by voice
          </button>
          <p className="mt-2 text-xs text-ink-2">Or send without them. The reply won&apos;t make anything up.</p>
        </motion.div>
      )}

      <Section title="What I understood" icon={ShieldCheck}>
        {thinking ? <ListSkeleton rows={3} /> : <FactList facts={proposal.understoodFacts} />}
        {proposal.dropped.length > 0 && (
          <p className="mt-3 rounded-xl bg-surface-2 p-3 text-xs text-ink-2">
            Ignored {proposal.dropped.length} suggested action{proposal.dropped.length > 1 ? "s" : ""} that didn&apos;t
            come from your words.
          </p>
        )}
      </Section>

      <DraftSection threadId={threadId} proposal={proposal} />

      {proposal.status !== "thinking" && (proposal.actions.length > 0 || proposal.status === "ready") && (
        <Section title="Confirm to act" icon={Check}>
          <div className="space-y-3">
            {proposal.status === "ready" && <SendCard threadId={threadId} disabled={false} />}
            {proposal.actions.map((a) =>
              a.type === "calendar_event" ? (
                <CalendarCard key={a.id} threadId={threadId} action={a} />
              ) : (
                <TravelCard key={a.id} threadId={threadId} action={a} />
              ),
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  aside,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <Icon className="size-4 text-ink-2" aria-hidden />
        {title}
        {aside && <span className="ml-auto">{aside}</span>}
      </h2>
      {children}
    </section>
  );
}

function AskList({ asks, flagged }: { asks: Ask[]; flagged: boolean }) {
  if (asks.length === 0)
    return (
      <div className="rounded-2xl border border-dashed border-line p-5 text-sm text-ink-2">
        {flagged
          ? "No genuine questions for you here. Say what you want to reply, or ignore it."
          : "No direct questions in this email. Say what you'd like to reply."}
      </div>
    );
  return (
    <Section title={`${asks.length} question${asks.length > 1 ? "s" : ""} to answer`} icon={ListChecks}>
      <ol className="space-y-2">
        {asks.map((a, i) => (
          <motion.li
            key={a.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 text-sm"
          >
            <span className="grid size-5 shrink-0 place-items-center rounded-full border border-line-strong text-[11px] text-mute">
              {i + 1}
            </span>
            <span className="text-ink">{a.text}</span>
          </motion.li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-mute">Answer them in any order, in one go. Sayso will match them up.</p>
    </Section>
  );
}

function CoverageScore({ proposal, total }: { proposal: ProposalState; total: number }) {
  const answered = proposal.coverage.filter((c) => c.status === "answered").length;
  return (
    <span className={cn("text-xs font-medium", answered === total ? "text-ok" : "text-warn")}>
      {answered} of {total}
    </span>
  );
}

function CoverageList({ asks, proposal }: { asks: Ask[]; proposal: ProposalState }) {
  return (
    <ol className="space-y-2">
      {asks.map((a, i) => {
        const c = proposal.coverage.find((x) => x.askId === a.id);
        const st = c?.status ?? "missing";
        return (
          <motion.li
            key={a.id}
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className={cn(
              "flex gap-3 rounded-xl border px-3 py-2.5 text-sm",
              st === "answered" && "border-ok/25 bg-ok-soft/50",
              st === "partial" && "border-warn/30 bg-warn-soft/50",
              st === "missing" && "border-warn/30 bg-warn-soft/70",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full",
                st === "answered" ? "bg-ok text-surface" : "border border-warn text-warn",
              )}
            >
              {st === "answered" ? (
                <Check className="size-3" strokeWidth={3} />
              ) : st === "partial" ? (
                <CircleDashed className="size-3" />
              ) : (
                <span className="text-[11px] font-bold">!</span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-ink">{a.text}</span>
              <span className={cn("block text-xs", st === "answered" ? "text-ok" : "text-warn")}>
                {st === "missing" ? "Not answered" : st === "partial" ? `Partly: ${c?.answer ?? ""}` : c?.answer}
              </span>
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}

const FACT_STYLE: Record<Fact["kind"], { cls: string; icon: React.ComponentType<{ className?: string }>; note?: string }> = {
  answer: { cls: "border-ok/25 bg-ok-soft text-ok", icon: Check },
  instruction: { cls: "border-signal/25 bg-signal-soft text-signal", icon: Check },
  correction: { cls: "border-signal/25 bg-signal-soft text-signal", icon: Undo2, note: "Correction applied" },
  private: { cls: "border-line bg-surface-2 text-mute", icon: EyeOff, note: "Kept out of the reply" },
  uncertain: { cls: "border-warn/35 bg-warn-soft text-warn", icon: AlertTriangle, note: "Check this before sending" },
};

function FactList({ facts }: { facts: (Fact & { verified: boolean })[] }) {
  if (facts.length === 0) return <p className="text-sm text-mute">Nothing concrete yet. Try saying a bit more.</p>;
  return (
    <ul className="space-y-3">
      {facts.map((f, i) => {
        const style = f.verified ? FACT_STYLE[f.kind] : FACT_STYLE.uncertain;
        const Icon = style.icon;
        return (
          <motion.li
            key={`${f.phrase}-${i}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <p className="text-xs text-mute">
              You said <span className="text-ink-2">&ldquo;{f.phrase}&rdquo;</span>
            </p>
            <span className={cn("mt-1 inline-flex items-start gap-1.5 rounded-xl border px-2.5 py-1 text-sm font-medium", style.cls)}>
              <Icon className="mt-0.5 size-3.5 shrink-0" />
              {f.fact}
            </span>
            {(style.note || !f.verified) && (
              <p className="mt-0.5 text-xs text-mute">{f.verified ? style.note : "Couldn't find this in your words. Check it."}</p>
            )}
          </motion.li>
        );
      })}
    </ul>
  );
}

function DraftSection({ threadId, proposal }: { threadId: string; proposal: ProposalState }) {
  const setBody = useApp((s) => s.setReplyBody);
  const sent = useApp((s) => s.actionStatus[`${threadId}:send`] === "done");
  const streaming = proposal.status === "drafting";
  const thinking = proposal.status === "thinking";

  return (
    <Section title="Draft reply" icon={Mic}>
      <div className="rounded-2xl border border-line bg-surface">
        {proposal.replySubject && (
          <p className="truncate border-b border-line px-4 py-2.5 text-sm text-ink">
            <span className="text-mute">Subject </span>
            {proposal.replySubject}
          </p>
        )}
        {thinking ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ) : proposal.status === "ready" && !sent ? (
          <>
            <label htmlFor={`draft-${threadId}`} className="sr-only">
              Reply body, editable
            </label>
            <textarea
              id={`draft-${threadId}`}
              value={proposal.replyBody}
              onChange={(e) => setBody(threadId, e.target.value)}
              className="field-sizing-content min-h-40 w-full resize-none bg-transparent p-4 text-[0.95rem] leading-relaxed text-ink outline-none"
            />
          </>
        ) : (
          <div className="min-h-40 p-4 text-[0.95rem] leading-relaxed whitespace-pre-wrap text-ink" aria-live="polite">
            {proposal.replyBody}
            {streaming && <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-signal" />}
          </div>
        )}
      </div>
      {proposal.status === "ready" && !sent && <p className="mt-2 text-xs text-mute">Edit anything before you send.</p>}
    </Section>
  );
}

function AsksSkeleton() {
  return (
    <div aria-busy="true" aria-label="Reading the thread">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <ListChecks className="size-4 text-ink-2" /> Reading the thread…
      </p>
      <ListSkeleton rows={4} />
    </div>
  );
}

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-11 w-full rounded-xl" />
      ))}
    </div>
  );
}

function ErrorBlock({ message, onRetry, label }: { message: string; onRetry: () => void; label: string }) {
  return (
    <AnimatePresence>
      <motion.div
        role="alert"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="rounded-2xl border border-risk/30 bg-risk-soft p-4 text-sm text-risk"
      >
        <p>{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-full bg-surface px-3.5 font-medium text-ink hover:bg-surface-2"
        >
          <RotateCw className="size-3.5" /> {label}
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
