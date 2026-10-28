"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Keyboard, Mail, RotateCcw } from "lucide-react";
import { useDemo } from "@/lib/store/demo";
import { analyze, propose } from "@/lib/client/pipeline";
import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { InboxPane } from "./inbox";
import { ThreadView } from "./thread-view";
import { Composer } from "./composer";
import { ProposalPanel } from "./proposal-panel";
import { CalendarPanel } from "./calendar-panel";

const DESKTOP = "(min-width: 1024px)";
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => true,
  );
}

function isTyping(el: EventTarget | null) {
  return (
    el instanceof HTMLElement &&
    (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
  );
}

export function DemoApp() {
  const [hydrated, setHydrated] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const selectedId = useDemo((s) => s.selectedId);
  const thread = useDemo((s) => s.threads.find((t) => t.id === s.selectedId));
  const threads = useDemo((s) => s.threads);
  const analysis = useDemo((s) =>
    s.selectedId ? s.analyses[s.selectedId] : undefined,
  );
  const proposal = useDemo((s) =>
    s.selectedId ? s.proposals[s.selectedId] : undefined,
  );
  const transcript = useDemo((s) =>
    s.selectedId ? (s.transcripts[s.selectedId] ?? "") : "",
  );
  const tz = useDemo((s) => s.tz);
  const select = useDemo((s) => s.select);
  const setTranscript = useDemo((s) => s.setTranscript);
  const reset = useDemo((s) => s.reset);

  useEffect(() => {
    Promise.resolve(useDemo.persist.rehydrate()).then(() => {
      const s = useDemo.getState();
      if (!s.selectedId && window.matchMedia("(min-width: 1024px)").matches)
        s.select(s.threads[0]?.id ?? null);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated && selectedId) void analyze(selectedId);
  }, [hydrated, selectedId]);

  const open = useCallback(
    (id: string) => {
      select(id);
      requestAnimationFrame(() =>
        composerRef.current?.focus({ preventScroll: true }),
      );
    },
    [select],
  );

  const submit = useCallback(() => {
    if (selectedId) void propose(selectedId);
  }, [selectedId]);

  const focusComposerAtEnd = useCallback(() => {
    const el = composerRef.current;
    if (!el || !selectedId) return;
    const current = useDemo.getState().transcripts[selectedId] ?? "";
    if (current && !/\s$/.test(current))
      setTranscript(selectedId, current + " ");
    el.focus();
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    requestAnimationFrame(() =>
      el.setSelectionRange(el.value.length, el.value.length),
    );
  }, [selectedId, setTranscript]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "Enter") {
        const btn = document.querySelector<HTMLButtonElement>(
          '[data-shortcut="send"]:not(:disabled)',
        );
        if (btn) {
          e.preventDefault();
          btn.click();
        }
        return;
      }
      if (isTyping(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") {
        e.preventDefault();
        composerRef.current?.focus();
      } else if (e.key === "j" || e.key === "k") {
        const s = useDemo.getState();
        const idx = s.threads.findIndex((t) => t.id === s.selectedId);
        const next =
          s.threads[
            Math.min(
              Math.max(idx + (e.key === "j" ? 1 : -1), 0),
              s.threads.length - 1,
            )
          ];
        if (next) select(next.id);
      } else if (
        e.key === "Escape" &&
        !window.matchMedia("(min-width: 1024px)").matches
      ) {
        select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  const isDesktop = useIsDesktop();
  const busy =
    proposal?.status === "thinking" || proposal?.status === "drafting";
  const stale = Boolean(
    proposal && proposal.basedOn.trim() !== transcript.trim(),
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:px-4">
        <Logo />
        <span className="hidden rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink-2 sm:inline">
          Demo inbox · fictional data
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  aria-label="Keyboard shortcuts"
                  className="hidden size-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2 hover:text-ink md:grid"
                />
              }
            >
              <Keyboard className="size-4" />
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-64 text-left">
              <ul className="space-y-1">
                <li>/ focus the composer</li>
                <li>Ctrl/⌘ + Enter draft the reply</li>
                <li>Ctrl/⌘ + Shift + Enter send</li>
                <li>j / k next or previous thread</li>
              </ul>
            </TooltipContent>
          </Tooltip>
          <button
            type="button"
            onClick={() => {
              reset();
              toast.success("Demo reset", {
                description: "Inbox, calendar and Sent are back to the start.",
              });
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <RotateCcw className="size-3.5" />{" "}
            <span className="hidden sm:inline">Reset demo</span>
            <span className="sm:hidden">Reset</span>
          </button>
          <Link
            href="/connect"
            className="hidden h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm font-medium text-ink hover:bg-surface-2 sm:inline-flex"
          >
            <Mail className="size-3.5" /> Connect Gmail
          </Link>
          <ThemeToggle />
        </div>
      </header>

      {!hydrated ? (
        <ShellSkeleton />
      ) : (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)_400px] xl:grid-cols-[320px_minmax(0,1fr)_440px]">
          <aside
            aria-label="Inbox"
            className={cn(
              "min-h-0 border-r border-line bg-canvas",
              selectedId ? "hidden lg:block" : "block",
            )}
          >
            <InboxPane onOpen={open} />
          </aside>

          {thread ? (
            <>
              <main
                id="main"
                className="min-h-0 overflow-y-auto lg:flex lg:flex-col"
                aria-label="Thread and reply"
              >
                <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-5 pb-4 sm:px-6">
                  <ThreadView
                    thread={thread}
                    analysis={analysis}
                    tz={tz}
                    onBack={() => select(null)}
                  />
                </div>
                <div className="z-10 mx-auto w-full max-w-3xl px-4 pt-2 pb-6 sm:px-6 lg:sticky lg:bottom-0 lg:bg-gradient-to-t lg:from-canvas lg:via-canvas lg:to-transparent lg:pt-6 lg:pb-4">
                  <Composer
                    ref={composerRef}
                    value={transcript}
                    onChange={(v) => setTranscript(thread.id, v)}
                    onSubmit={submit}
                    busy={busy}
                    hasDraft={Boolean(proposal)}
                    stale={stale}
                    disabled={analysis?.status !== "ready"}
                    disabledReason={
                      analysis?.status === "error"
                        ? "Read the thread first, then answer."
                        : "Reading the thread…"
                    }
                  />
                </div>
                {/* Mobile: proposal stacks under the composer. Rendered once, so ids stay unique. */}
                {!isDesktop && (
                  <div className="space-y-8 px-4 pb-10">
                    <ProposalPanel
                      threadId={thread.id}
                      analysis={analysis}
                      proposal={proposal}
                      onRetryAnalysis={() =>
                        analyze(thread.id, { force: true })
                      }
                      onRetryProposal={submit}
                      onAnswerGap={focusComposerAtEnd}
                    />
                    <CalendarPanel />
                  </div>
                )}
              </main>
              {isDesktop && (
                <aside
                  aria-label="What Sayso understood"
                  className="min-h-0 space-y-8 overflow-y-auto border-l border-line bg-surface/50 p-5"
                >
                  <ProposalPanel
                    threadId={thread.id}
                    analysis={analysis}
                    proposal={proposal}
                    onRetryAnalysis={() => analyze(thread.id, { force: true })}
                    onRetryProposal={submit}
                    onAnswerGap={focusComposerAtEnd}
                  />
                  <CalendarPanel />
                </aside>
              )}
            </>
          ) : (
            <div className="hidden min-h-0 items-center justify-center p-10 text-center lg:col-span-2 lg:flex">
              <div>
                <p className="text-title text-2xl text-ink">
                  Pick a thread to answer
                </p>
                <p className="mt-2 text-ink-2">
                  {threads.length} emails waiting. Start with Mira&apos;s, it
                  has five questions.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="grid flex-1 gap-4 p-4 lg:grid-cols-[300px_1fr_400px]">
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
      <div className="hidden space-y-3 lg:block">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
      <div className="hidden space-y-2 lg:block">
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  );
}
