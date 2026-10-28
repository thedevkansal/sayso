"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

// Fixed bar profile so server and client render the same heights.
const PROFILE = [0.25, 0.5, 0.35, 0.8, 0.55, 1, 0.7, 0.4, 0.9, 0.6, 0.3, 0.75, 0.45, 0.85, 0.5, 0.3, 0.6, 0.35];

export function Waveform({
  active = true,
  bars = PROFILE.length,
  className,
  barClassName,
}: {
  active?: boolean;
  bars?: number;
  className?: string;
  barClassName?: string;
}) {
  const reduce = useReducedMotion();
  const profile = PROFILE.slice(0, bars);

  return (
    <div aria-hidden className={cn("flex h-8 items-center gap-[3px]", className)}>
      {profile.map((h, i) => (
        <motion.span
          key={i}
          className={cn("w-[3px] rounded-full bg-current", barClassName)}
          style={{ height: "100%", originY: 0.5 }}
          initial={{ scaleY: h * 0.6 }}
          animate={
            active && !reduce
              ? { scaleY: [h * 0.35, h, h * 0.5, h * 0.85, h * 0.35] }
              : { scaleY: active ? h : 0.12 }
          }
          transition={
            active && !reduce
              ? { duration: 1.1 + (i % 5) * 0.17, repeat: Infinity, ease: "easeInOut", delay: (i % 7) * 0.06 }
              : { duration: 0.3 }
          }
        />
      ))}
    </div>
  );
}
