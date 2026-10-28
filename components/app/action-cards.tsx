"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, CalendarPlus, Check, ExternalLink, Mail, Plane, TrainFront, X } from "lucide-react";
import type { CalendarAction, TravelAction } from "@/lib/schemas";
import { actionKey, useDemo } from "@/lib/store/demo";
import { conflictsFor, nextFreeSlot } from "@/lib/calendar";
import { formatDay, formatRange, formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

function CardShell({
  icon: Icon,
  title,
  done,
  doneLabel,
  children,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  done: boolean;
  doneLabel: string;
  children: React.ReactNode;
  tone?: "default" | "warn";
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "overflow-hidden rounded-2xl border bg-surface",
        done ? "border-ok/30" : tone === "warn" ? "border-warn/40" : "border-line",
      )}
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-sm">
        <Icon className="size-4 text-ink-2" />
        <span className="font-medium text-ink">{title}</span>
        <AnimatePresence>
          {done && (
            <motion.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-xs font-medium text-ok"
            >
              <Check className="size-3" strokeWidth={3} /> {doneLabel}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <div className="p-4">{children}</div>
    </motion.div>
  );
}

const primaryBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-40";
const secondaryBtn =
  "inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-sm font-medium text-ink hover:bg-surface-2";
const ghostBtn = "inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm text-mute hover:bg-surface-2 hover:text-ink";

export function SendCard({ threadId, disabled }: { threadId: string; disabled: boolean }) {
  const p = useDemo((s) => s.proposals[threadId]);
  const thread = useDemo((s) => s.threads.find((t) => t.id === threadId));
  const status = useDemo((s) => s.actionStatus[`${threadId}:send`]);
  const sendReply = useDemo((s) => s.sendReply);
  if (!p || !thread) return null;
  const to = thread.messages.at(-1)!.from;
  const done = status === "done";

  return (
    <CardShell icon={Mail} title="Send reply" done={done} doneLabel="Sent">
      <dl className="grid grid-cols-[4.5rem_1fr] gap-y-1 text-sm">
        <dt className="text-mute">To</dt>
        <dd className="truncate text-ink">
          {to.name} &lt;{to.email}&gt;
        </dd>
        <dt className="text-mute">Subject</dt>
        <dd className="truncate text-ink">{p.replySubject}</dd>
      </dl>
      {!done && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            data-shortcut="send"
            disabled={disabled || !p.replyBody.trim()}
            className={primaryBtn}
            onClick={() => {
              const item = sendReply(threadId);
              if (item) toast.success("Reply sent", { description: "Saved to Sent. In the demo nothing leaves your browser." });
            }}
          >
            Send reply
          </button>
          <span className="text-xs text-mute">Demo: goes to your in-app Sent folder</span>
        </div>
      )}
    </CardShell>
  );
}

export function CalendarCard({ threadId, action }: { threadId: string; action: CalendarAction }) {
  const key = actionKey(threadId, action.id);
  const status = useDemo((s) => s.actionStatus[key]);
  const events = useDemo((s) => s.events);
  const tz = useDemo((s) => s.tz);
  const addEvent = useDemo((s) => s.addEvent);
  const setStatus = useDemo((s) => s.setActionStatus);
  const done = status === "done";

  const conflicts = useMemo(
    () => (done ? [] : conflictsFor(events, action.startISO, action.endISO)),
    [events, action, done],
  );
  const alt = useMemo(
    () => (conflicts.length ? nextFreeSlot(events, action.startISO, action.endISO) : null),
    [conflicts, events, action],
  );

  if (status === "dismissed") return <DismissedRow label="Calendar invite dismissed" onUndo={() => setStatus(key, "pending")} />;

  const book = (startISO: string, endISO: string) => {
    addEvent({ id: `ev-${key}`, title: action.title, startISO, endISO, source: "sayso", attendees: action.attendees });
    setStatus(key, "done");
    const label = formatRange(startISO, endISO, tz);
    // Moved to another slot: keep the email in sync with what was actually booked.
    if (startISO !== action.startISO) {
      const s = useDemo.getState();
      const body = s.proposals[threadId]?.replyBody ?? "";
      const original = formatRange(action.startISO, action.endISO, tz);
      if (body.includes(original)) s.setReplyBody(threadId, body.replaceAll(original, label));
    }
    toast.success("Added to calendar", { description: label });
  };

  return (
    <CardShell icon={CalendarPlus} title="Calendar invite" done={done} doneLabel="Added" tone={conflicts.length ? "warn" : "default"}>
      <p className="font-medium text-ink">{action.title}</p>
      <p className="mt-0.5 text-sm text-ink">{formatRange(action.startISO, action.endISO, tz)}</p>
      {action.attendees.length > 0 && <p className="mt-1 text-xs text-mute">Invite: {action.attendees.join(", ")}</p>}
      <p className="mt-2 text-xs text-mute">From what you said: &ldquo;{action.sourceQuote}&rdquo;</p>

      {conflicts.length > 0 && (
        <div className="mt-3 rounded-xl bg-warn-soft p-3 text-sm text-warn">
          <p className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="size-4" /> Clashes with {conflicts.length === 1 ? "an event" : `${conflicts.length} events`}
          </p>
          <ul className="mt-1 space-y-0.5">
            {conflicts.map((c) => (
              <li key={c.id}>
                {c.title}, {formatTime(c.startISO, tz)}–{formatTime(c.endISO, tz)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {conflicts.length === 0 && !done && <p className="mt-3 text-sm text-ok">No conflicts in your calendar</p>}

      {!done && (
        <div className="mt-4 flex flex-wrap gap-2">
          {alt ? (
            <>
              <button type="button" className={primaryBtn} onClick={() => book(alt.startISO, alt.endISO)}>
                Book {formatTime(alt.startISO, tz)} instead
              </button>
              <button type="button" className={secondaryBtn} onClick={() => book(action.startISO, action.endISO)}>
                Book anyway
              </button>
            </>
          ) : (
            <button type="button" className={primaryBtn} onClick={() => book(action.startISO, action.endISO)}>
              Add to calendar
            </button>
          )}
          <button type="button" className={ghostBtn} onClick={() => setStatus(key, "dismissed")}>
            <X className="size-3.5" /> Dismiss
          </button>
        </div>
      )}
    </CardShell>
  );
}

function trainSearchUrl(a: TravelAction) {
  const q = `trains from ${a.origin} to ${a.destination} on ${a.date}`;
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export function TravelCard({ threadId, action }: { threadId: string; action: TravelAction }) {
  const key = actionKey(threadId, action.id);
  const status = useDemo((s) => s.actionStatus[key]);
  const tz = useDemo((s) => s.tz);
  const setStatus = useDemo((s) => s.setActionStatus);
  if (status === "dismissed") return <DismissedRow label="Travel search dismissed" onUndo={() => setStatus(key, "pending")} />;
  const Icon = action.mode === "train" ? TrainFront : Plane;
  const when = action.timeOfDay === "any" ? "" : `, ${action.timeOfDay}`;

  return (
    <CardShell icon={Icon} title={action.mode === "train" ? "Train options" : "Flight options"} done={status === "done"} doneLabel="Booked">
      <p className="font-medium text-ink">
        {action.origin}
        {action.originCode ? ` (${action.originCode})` : ""} → {action.destination}
        {action.destinationCode ? ` (${action.destinationCode})` : ""}
      </p>
      <p className="mt-0.5 text-sm text-ink">
        {formatDay(action.date, tz)}
        {when} · {action.passengers} {action.passengers === 1 ? "traveller" : "travellers"}
      </p>
      <p className="mt-2 text-xs text-mute">From what you said: &ldquo;{action.sourceQuote}&rdquo;</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {action.mode === "flight" ? (
          <span className="inline-flex h-9 items-center rounded-full bg-surface-2 px-3.5 text-sm text-mute">
            Test-mode flight search is coming next
          </span>
        ) : null}
        <a href={trainSearchUrl(action)} target="_blank" rel="noopener noreferrer" className={secondaryBtn}>
          Search trains <ExternalLink className="size-3.5" />
        </a>
        <button type="button" className={ghostBtn} onClick={() => setStatus(key, "dismissed")}>
          <X className="size-3.5" /> Dismiss
        </button>
      </div>
    </CardShell>
  );
}

function DismissedRow({ label, onUndo }: { label: string; onUndo: () => void }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-dashed border-line px-4 py-2.5 text-sm text-mute">
      {label}
      <button type="button" onClick={onUndo} className="font-medium text-ink hover:underline">
        Undo
      </button>
    </div>
  );
}
