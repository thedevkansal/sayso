"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Keyboard, LogOut, Mail, RefreshCw, RotateCcw } from "lucide-react";
import { signOut } from "next-auth/react";
import { MotionConfig } from "motion/react";
import { AppStoreContext, useApp, useAppApi, useDemo, useLive, type Mode } from "@/lib/store/demo";
import { analyze, loadCalendar, loadInbox, propose } from "@/lib/client/pipeline";
import { Logo } from "@/components/site/logo";
import { ThemeToggle } from "@/components/site/theme-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
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
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/** Demo uses the seeded, persisted store; live uses an in-memory store fed by Gmail and Calendar. */
export function AppShell({ mode }: { mode: Mode }) {
  return (
    <AppStoreContext.Provider value={mode === "live" ? useLive : useDemo}>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <Shell />
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </MotionConfig>
    </AppStoreContext.Provider>
  );
}

function Shell() {
  const api = useAppApi();
  const live = useApp((s) => s.mode === "live");
  const [hydrated, setHydrated] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const inbox = useApp((s) => s.inbox);
  const user = useApp((s) => s.user);
  const selectedId = useApp((s) => s.selectedId);
  const thread = useApp((s) => s.threads.find((t) => t.id === s.selectedId));
  const threadCount = useApp((s) => s.threads.length);
  const threadLoaded = useApp((s) => (s.selectedId ? s.loadedThreads[s.selectedId] : undefined));
  const analysis = useApp((s) => (s.selectedId ? s.analyses[s.selectedId] : undefined));
  const proposal = useApp((s) => (s.selectedId ? s.proposals[s.selectedId] : undefined));
  const transcript = useApp((s) => (s.selectedId ? (s.transcripts[s.selectedId] ?? "") : ""));
  const tz = useApp((s) => s.tz);
  const select = useApp((s) => s.select);
  const setTranscript = useApp((s) => s.setTranscript);
  const reset = useApp((s) => s.reset);

  useEffect(() => {
    if (live) {
      // Nothing to rehydrate: live data is fetched fresh and never written to storage.
      void Promise.all([loadInbox(api), loadCalendar(api)]).then(() => setHydrated(true));
      return;
    }
    Promise.resolve(useDemo.persist.rehydrate()).then(() => {
      const s = useDemo.getState();
      if (!s.selectedId && window.matchMedia(DESKTOP).matches) s.select(s.threads[0]?.id ?? null);
      setHydrated(true);
    });
  }, [api, live]);

  useEffect(() => {
    if (hydrated && selectedId) void analyze(api, selectedId);
  }, [api, hydrated, selectedId]);

  const open = useCallback(
    (id: string) => {
      select(id);
      requestAnimationFrame(() => composerRef.current?.focus({ preventScroll: true }));
    },
    [select],
  );

  const submit = useCallback(() => {
    if (selectedId) void propose(api, selectedId);
  }, [api, selectedId]);

  const focusComposerAtEnd = useCallback(() => {
    const el = composerRef.current;
    if (!el || !selectedId) return;
    const current = api.getState().transcripts[selectedId] ?? "";
    if (current && !/\s$/.test(current)) setTranscript(selectedId, current + " ");
    el.focus();
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
  }, [api, selectedId, setTranscript]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "Enter") {
        const btn = document.querySelector<HTMLButtonElement>('[data-shortcut="send"]:not(:disabled)');
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
        const s = api.getState();
        const idx = s.threads.findIndex((t) => t.id === s.selectedId);
        const next = s.threads[Math.min(Math.max(idx + (e.key === "j" ? 1 : -1), 0), s.threads.length - 1)];
        if (next) select(next.id);
      } else if (e.key === "Escape" && !window.matchMedia(DESKTOP).matches) {
        select(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api, select]);

  const isDesktop = useIsDesktop();
  const busy = proposal?.status === "thinking" || proposal?.status === "drafting";
  const stale = Boolean(proposal && proposal.basedOn.trim() !== transcript.trim());

  const panel = thread ? (
    <>
      <ProposalPanel
        threadId={thread.id}
        analysis={analysis}
        proposal={proposal}
        onRetryAnalysis={() => analyze(api, thread.id, { force: true })}
        onRetryProposal={submit}
        onAnswerGap={focusComposerAtEnd}
      />
      <CalendarPanel />
    </>
  ) : null;

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:px-4">
        <Logo />
        {live ? (
          <span className="hidden max-w-64 items-center gap-1.5 truncate rounded-full border border-ok/30 bg-ok-soft px-2.5 py-1 text-xs text-ok sm:inline-flex">
            <span className="size-1.5 shrink-0 rounded-full bg-ok" /> Live · {user.email || "Gmail"}
          </span>
        ) : (
          <span className="hidden rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs text-ink-2 sm:inline">
            Demo inbox · fictional data
          </span>
        )}
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
          {live ? (
            <>
              <button
                type="button"
                onClick={() => {
                  void loadInbox(api);
                  void loadCalendar(api);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
              >
                <RefreshCw className={cn("size-3.5", inbox.status === "loading" && "animate-spin")} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  reset();
                  void signOut({ redirectTo: "/connect" });
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm font-medium text-ink hover:bg-surface-2"
              >
                <LogOut className="size-3.5" /> <span className="hidden sm:inline">Disconnect</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  reset();
                  toast.success("Demo reset", { description: "Inbox, calendar and Sent are back to the start." });
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
              >
                <RotateCcw className="size-3.5" /> <span className="hidden sm:inline">Reset demo</span>
                <span className="sm:hidden">Reset</span>
              </button>
              <Link
                href="/connect"
                className="hidden h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm font-medium text-ink hover:bg-surface-2 sm:inline-flex"
              >
                <Mail className="size-3.5" /> Connect Gmail
              </Link>
            </>
          )}
          <ThemeToggle />
        </div>
      </header>

      {!hydrated ? (
        <ShellSkeleton />
      ) : live && inbox.status === "error" ? (
        <LiveError message={inbox.message} code={inbox.code} onRetry={() => void loadInbox(api)} />
      ) : (
        <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)_400px] xl:grid-cols-[320px_minmax(0,1fr)_440px]">
          <aside
            aria-label="Inbox"
            className={cn("min-h-0 border-r border-line bg-canvas", selectedId ? "hidden lg:block" : "block")}
          >
            <InboxPane onOpen={open} />
          </aside>

          {thread ? (
            <>
              <main id="main" className="min-h-0 overflow-y-auto lg:flex lg:flex-col" aria-label="Thread and reply">
                <div className="mx-auto w-full max-w-3xl flex-1 px-4 pt-5 pb-4 sm:px-6">
                  <ThreadView
                    thread={thread}
                    analysis={analysis}
                    tz={tz}
                    loading={live && threadLoaded !== "ready" && threadLoaded !== "error"}
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
                    disabled={analysis?.status === "error"}
                    disabledReason={
                      analysis?.status === "error"
                        ? "Read the thread again (right panel), then draft."
                        : analysis?.status === "loading"
                          ? "Reading the thread… you can start talking now."
                          : undefined
                    }
                  />
                </div>
                {/* Mobile: proposal stacks under the composer. Rendered once, so ids stay unique. */}
                {!isDesktop && <div className="space-y-8 px-4 pb-10">{panel}</div>}
              </main>
              {isDesktop && (
                <aside
                  aria-label="What Sayso understood"
                  className="min-h-0 space-y-8 overflow-y-auto border-l border-line bg-surface/50 p-5"
                >
                  {panel}
                </aside>
              )}
            </>
          ) : (
            <div className="hidden min-h-0 items-center justify-center p-10 text-center lg:col-span-2 lg:flex">
              <div>
                <p className="text-title text-2xl text-ink">Pick a thread to answer</p>
                <p className="mt-2 text-ink-2">
                  {live
                    ? `${threadCount} recent threads from your inbox. Nothing is sent without your click.`
                    : "5 emails waiting. Start with Mira's, it has five questions."}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LiveError({ message, code, onRetry }: { message: string; code?: string; onRetry: () => void }) {
  const needsConnect = code === "not_connected" || code === "reconnect" || code === "forbidden";
  return (
    <div className="flex flex-1 items-center justify-center p-8 text-center">
      <div className="max-w-md">
        <p className="text-title text-2xl text-ink">{needsConnect ? "Connect Google to continue" : "Couldn't load your inbox"}</p>
        <p className="mt-2 text-ink-2">{message}</p>
        <div className="mt-6 flex justify-center gap-2">
          {needsConnect ? (
            <Link href="/connect" className="inline-flex h-11 items-center rounded-full bg-ink px-5 font-medium text-primary-foreground">
              Connect Google
            </Link>
          ) : (
            <button type="button" onClick={onRetry} className="inline-flex h-11 items-center rounded-full bg-ink px-5 font-medium text-primary-foreground">
              Try again
            </button>
          )}
          <Link href="/app" className="inline-flex h-11 items-center rounded-full border border-line-strong px-5 font-medium text-ink">
            Use the demo
          </Link>
        </div>
      </div>
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
