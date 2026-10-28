"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { CornerDownLeft, Loader2, RotateCw } from "lucide-react";
import { Waveform } from "@/components/site/waveform";
import { LIMITS } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { FlowKeyHint } from "./flow-key";

// The app shell only renders after client hydration, so navigator is available here.
function useSubmitKey() {
  const [label] = useState(() =>
    typeof navigator === "undefined" || /Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl",
  );
  return label;
}

export const Composer = forwardRef<
  HTMLTextAreaElement,
  {
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
    busy: boolean;
    hasDraft: boolean;
    stale: boolean;
    disabled?: boolean;
    disabledReason?: string;
  }
>(function Composer({ value, onChange, onSubmit, busy, hasDraft, stale, disabled, disabledReason }, ref) {
  const submitKey = useSubmitKey();
  const [burst, setBurst] = useState(false);
  const [focused, setFocused] = useState(false);
  const prevLen = useRef(value.length);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Flow inserts a whole utterance at once; a big jump in length is our "heard you" moment.
  useEffect(() => {
    const jump = value.length - prevLen.current;
    prevLen.current = value.length;
    if (jump > 12) {
      setBurst(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setBurst(false), 1400);
    }
  }, [value]);

  const canSubmit = value.trim().length > 0 && !busy && !disabled;
  const label = busy ? "Drafting…" : hasDraft ? (stale ? "Update draft" : "Redraft") : "Draft reply";

  return (
    <div
      className={cn(
        "rounded-3xl border bg-surface p-3 shadow-float transition-colors sm:p-4",
        focused ? "border-line-strong" : "border-line",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="relative mt-1 grid size-11 shrink-0 place-items-center" aria-hidden>
          <motion.span
            className="voice-ring absolute inset-0 rounded-full"
            animate={{ opacity: burst ? 1 : focused ? 0.55 : 0.2, rotate: burst ? 360 : 0 }}
            transition={burst ? { duration: 1.4, ease: "easeOut" } : { duration: 0.4 }}
          />
          <span className="absolute inset-[3px] rounded-full bg-surface" />
          <Waveform active={burst} bars={6} className="relative h-4 text-ink" />
        </div>
        <div className="min-w-0 flex-1">
          <label htmlFor="composer" className="sr-only">
            Your answer
          </label>
          <textarea
            id="composer"
            ref={ref}
            value={value}
            maxLength={LIMITS.transcript}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                if (canSubmit) onSubmit();
              }
            }}
            rows={3}
            placeholder="Hold your Wispr Flow key and talk. Answer in any order; say “no wait” to correct yourself."
            className="field-sizing-content max-h-64 min-h-[5.5rem] w-full resize-none bg-transparent pt-2 text-[1.05rem] leading-relaxed text-ink outline-none placeholder:text-mute"
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <div className="text-xs text-mute">{disabledReason ? <p>{disabledReason}</p> : <FlowKeyHint />}</div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : hasDraft ? <RotateCw className="size-4" /> : null}
          {label}
          {!busy && (
            <span className="hidden items-center gap-0.5 rounded-md bg-primary-foreground/15 px-1.5 py-0.5 text-[11px] sm:inline-flex">
              {submitKey} <CornerDownLeft className="size-3" />
            </span>
          )}
        </button>
      </div>
    </div>
  );
});
