"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";
import { CalendarClock, Check, CircleAlert, CornerDownLeft, Mail } from "lucide-react";
import { Waveform } from "@/components/site/waveform";
import { cn } from "@/lib/utils";

const TRANSCRIPT =
  "Okay so she's arriving the 14th, talk is 30 minutes, yes we cover the hotel, and set a call with her Friday 4 pm, no wait, 5.";

const ASKS = [
  { q: "When are you arriving?", a: "Arriving Sat 14 Nov", at: 0.28 },
  { q: "How long is my talk?", a: "30 minutes", at: 0.42 },
  { q: "What AV will be set up?", a: null, at: 1 },
  { q: "Is the hotel covered?", a: "Yes, hotel covered", at: 0.62 },
  { q: "Any dietary notes needed?", a: null, at: 1 },
];

const WORDS = TRANSCRIPT.split(" ");

/**
 * Loops a scripted run of the real product: dictation streams in, asks tick off,
 * the two unanswered ones get flagged, then the draft and the calendar card appear.
 */
export function HeroVisual() {
  return (
    <MotionConfig reducedMotion="user">
      <HeroLoop />
    </MotionConfig>
  );
}

function HeroLoop() {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);
  const total = WORDS.length + 14;

  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setTick((t) => (t + 1) % (total + 10)), 190);
    return () => clearInterval(id);
  }, [reduce, total]);

  const t = reduce ? total : Math.min(tick, total);
  const shown = Math.min(t, WORDS.length);
  const progress = shown / WORDS.length;
  const listening = !reduce && shown < WORDS.length;
  const done = t >= WORDS.length + 3;
  const drafted = t >= WORDS.length + 7;

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      {/* floating status chips, à la notification toasts */}
      <AnimatePresence>
        {done && (
          <motion.div
            key="gap"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -top-5 left-2 z-10 hidden items-center gap-2.5 rounded-2xl border border-line bg-surface py-2 pr-4 pl-2 shadow-float sm:flex md:-left-6"
          >
            <span className="grid size-8 place-items-center rounded-full bg-warn-soft text-warn">
              <CircleAlert className="size-4" />
            </span>
            <span className="text-left text-xs leading-tight">
              <span className="block font-medium text-ink">2 questions not answered</span>
              <span className="text-mute">AV setup · dietary notes</span>
            </span>
          </motion.div>
        )}
        {drafted && (
          <motion.div
            key="cal"
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -top-5 right-2 z-10 hidden items-center gap-2.5 rounded-2xl border border-line bg-surface py-2 pr-4 pl-2 shadow-float sm:flex md:-right-6"
          >
            <span className="grid size-8 place-items-center rounded-full bg-signal-soft text-signal">
              <CalendarClock className="size-4" />
            </span>
            <span className="text-left text-xs leading-tight">
              <span className="block font-medium text-ink">Call with Mira, ready to confirm</span>
              <span className="text-mute">Fri, 5:00–5:30 pm IST · no conflicts</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="overflow-hidden rounded-[22px] border border-line bg-surface shadow-float">
        {/* window chrome */}
        <div className="flex items-center gap-3 border-b border-line bg-surface-2 px-4 py-2.5">
          <div className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
            <span className="size-2.5 rounded-full bg-line-strong" />
          </div>
          <div className="mx-auto rounded-md border border-line bg-surface px-3 py-0.5 font-mono text-[11px] text-mute">
            sayso.app/app
          </div>
          <div className="w-10" />
        </div>

        <div className="grid text-left md:grid-cols-[1fr_1.1fr]">
          {/* thread */}
          <div className="border-b border-line p-5 md:border-r md:border-b-0">
            <div className="flex items-center gap-2 text-xs text-mute">
              <Mail className="size-3.5" /> Aurora Summit 2026 · Speaker logistics
            </div>
            <div className="mt-3 flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-full bg-[#e6dcff] text-xs font-semibold text-[#3b2a7a]">
                MO
              </span>
              <div className="leading-tight">
                <p className="text-sm font-medium text-ink">Mira Okafor</p>
                <p className="text-xs text-mute">to you · 9:12 am</p>
              </div>
            </div>
            <ul className="mt-4 space-y-2">
              {ASKS.map((ask, i) => {
                const answered = ask.a && progress >= ask.at;
                const missing = !ask.a && done;
                return (
                  <li
                    key={ask.q}
                    className={cn(
                      "flex items-start gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors duration-500",
                      answered && "border-ok/25 bg-ok-soft/60",
                      missing && "border-warn/30 bg-warn-soft/70",
                      !answered && !missing && "border-line bg-surface",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border text-[10px] transition-colors duration-500",
                        answered && "border-ok bg-ok text-surface",
                        missing && "border-warn text-warn",
                        !answered && !missing && "border-line-strong text-mute",
                      )}
                    >
                      {answered ? <Check className="size-3" strokeWidth={3} /> : missing ? "!" : i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-ink">{ask.q}</span>
                      <AnimatePresence initial={false}>
                        {answered && (
                          <motion.span
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="block text-xs text-ok"
                          >
                            {ask.a}
                          </motion.span>
                        )}
                        {missing && (
                          <motion.span
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            className="block text-xs text-warn"
                          >
                            You didn&apos;t answer this
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* composer + result */}
          <div className="flex flex-col p-5">
            <div className="flex items-center gap-3">
              <div className="relative grid size-12 shrink-0 place-items-center">
                <motion.span
                  className="voice-ring absolute inset-0 rounded-full"
                  animate={listening ? { rotate: 360 } : { rotate: 0 }}
                  transition={listening ? { duration: 4, repeat: Infinity, ease: "linear" } : { duration: 0.6 }}
                  style={{ opacity: listening ? 1 : 0.35 }}
                />
                <span className="absolute inset-[3px] rounded-full bg-surface" />
                <Waveform active={listening} bars={7} className="relative h-5 text-ink" />
              </div>
              <div className="text-xs leading-tight">
                <p className="font-medium text-ink">{listening ? "Listening via Wispr Flow" : "Got it"}</p>
                <p className="text-mute">
                  Hold your <span className="kbd">Flow key</span> and talk
                </p>
              </div>
            </div>

            <p className="mt-4 min-h-[5.5rem] rounded-xl bg-surface-2 p-3.5 text-[0.95rem] leading-relaxed text-ink">
              {WORDS.slice(0, shown).map((w, i) => {
                const corrected = w === "4" && shown > WORDS.indexOf("wait,");
                return (
                  <span key={i} className={cn(corrected && "text-mute line-through decoration-risk/70")}>
                    {w}{" "}
                  </span>
                );
              })}
              {listening && <span className="inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-signal" />}
            </p>

            <div className="mt-4 flex-1">
              <AnimatePresence mode="wait">
                {drafted ? (
                  <motion.div
                    key="draft"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-xl border border-line p-3.5 text-sm leading-relaxed"
                  >
                    <p className="text-xs text-mute">Draft reply</p>
                    <p className="mt-1.5 text-ink">
                      Hi Mira, great to have you. You arrive Sat 14 Nov, your talk is 30 minutes, and we cover your
                      hotel. I&apos;ve sent a call invite for Friday at 5 pm IST.
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-warn">Add AV and dietary answers?</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1 text-xs font-medium text-primary-foreground">
                        Review &amp; send <CornerDownLeft className="size-3" />
                      </span>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div key="skeleton" exit={{ opacity: 0 }} className="space-y-2 rounded-xl border border-dashed border-line p-3.5">
                    <div className="h-2.5 w-1/3 rounded bg-surface-2" />
                    <div className="h-2.5 w-full rounded bg-surface-2" />
                    <div className="h-2.5 w-5/6 rounded bg-surface-2" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
