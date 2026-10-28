"use client";

import { useMemo, useState } from "react";
import { Inbox as InboxIcon, Send, ShieldAlert, Star } from "lucide-react";
import { motion } from "motion/react";
import { useDemo } from "@/lib/store/demo";
import { detectInjection } from "@/lib/pipeline/guards";
import { inboxTime } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";

export function InboxPane({ onOpen }: { onOpen: (id: string) => void }) {
  const threads = useDemo((s) => s.threads);
  const sent = useDemo((s) => s.sent);
  const selectedId = useDemo((s) => s.selectedId);
  const analyses = useDemo((s) => s.analyses);
  const proposals = useDemo((s) => s.proposals);
  const actionStatus = useDemo((s) => s.actionStatus);
  const tz = useDemo((s) => s.tz);
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const now = useMemo(() => new Date(), []);
  const unread = threads.filter((t) => t.unread).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" aria-label="Mailbox" className="flex gap-1 border-b border-line p-2">
        <TabButton active={tab === "inbox"} onClick={() => setTab("inbox")} icon={InboxIcon} label="Inbox" count={unread} />
        <TabButton active={tab === "sent"} onClick={() => setTab("sent")} icon={Send} label="Sent" count={sent.length} muted />
      </div>

      {tab === "inbox" ? (
        <ul className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Threads">
          {threads.map((t, i) => {
            const a = analyses[t.id];
            const suspicious = (a?.status === "ready" && a.suspicious.flagged) || Boolean(detectInjection(t));
            const replied = actionStatus[`${t.id}:send`] === "done";
            const p = proposals[t.id];
            const last = t.messages.at(-1)!;
            return (
              <motion.li
                key={t.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
              >
                <button
                  type="button"
                  onClick={() => onOpen(t.id)}
                  aria-current={selectedId === t.id ? "true" : undefined}
                  className={cn(
                    "group relative flex w-full gap-3 rounded-2xl px-3 py-3 text-left transition-colors",
                    selectedId === t.id ? "bg-surface shadow-[0_0_0_1px_var(--line)]" : "hover:bg-surface/70",
                  )}
                >
                  {t.unread && <span className="absolute top-[1.35rem] left-1 size-1.5 rounded-full bg-signal" aria-label="Unread" />}
                  <Avatar name={last.from.name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-sm", t.unread ? "font-semibold text-ink" : "text-ink-2")}>
                        {last.from.name}
                      </span>
                      <span className="shrink-0 text-xs text-mute" suppressHydrationWarning>
                        {inboxTime(last.date, now, tz)}
                      </span>
                    </span>
                    <span className={cn("mt-0.5 block truncate text-sm", t.unread ? "text-ink" : "text-ink-2")}>
                      {t.subject}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-mute">{t.preview}</span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      {suspicious && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-risk-soft px-2 py-0.5 text-[11px] font-medium text-risk">
                          <ShieldAlert className="size-3" /> Suspicious
                        </span>
                      )}
                      {replied ? (
                        <span className="rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-medium text-ok">Replied</span>
                      ) : p?.status === "ready" ? (
                        <span className="rounded-full bg-signal-soft px-2 py-0.5 text-[11px] font-medium text-signal">Draft ready</span>
                      ) : null}
                      {t.tag && (
                        <span className="rounded-full border border-line px-2 py-0.5 text-[11px] text-mute">{t.tag}</span>
                      )}
                      {t.starred && <Star className="size-3.5 fill-warn text-warn" aria-label="Starred" />}
                    </span>
                  </span>
                </button>
              </motion.li>
            );
          })}
        </ul>
      ) : (
        <SentList />
      )}
    </div>
  );
}

function SentList() {
  const sent = useDemo((s) => s.sent);
  const tz = useDemo((s) => s.tz);
  const now = useMemo(() => new Date(), []);
  if (sent.length === 0)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <Send className="size-5 text-mute" aria-hidden />
        <p className="text-sm font-medium text-ink">Nothing sent yet</p>
        <p className="text-sm text-mute">Replies you confirm land here. In the demo nothing leaves your browser.</p>
      </div>
    );
  return (
    <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
      {sent.map((m) => (
        <li key={m.id} className="rounded-2xl border border-line bg-surface p-3">
          <p className="flex justify-between gap-2 text-xs text-mute">
            <span className="truncate">To {m.to.join(", ")}</span>
            <span>{inboxTime(m.sentAt, now, tz)}</span>
          </p>
          <p className="mt-1 truncate text-sm font-medium text-ink">{m.subject}</p>
          <p className="mt-1 line-clamp-3 text-xs whitespace-pre-line text-ink-2">{m.body}</p>
        </li>
      ))}
    </ul>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
  muted,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
        active ? "bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--line)]" : "text-ink-2 hover:text-ink",
      )}
    >
      <Icon className="size-4" />
      {label}
      {count > 0 && (
        <span
          className={cn(
            "min-w-5 rounded-full px-1.5 text-[11px] leading-5 font-medium",
            muted ? "bg-surface-2 text-mute" : "bg-ink text-primary-foreground",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
