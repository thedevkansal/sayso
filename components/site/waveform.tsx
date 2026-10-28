import { cn } from "@/lib/utils";

// Fixed bar profile so server and client render the same heights.
const PROFILE = [0.25, 0.5, 0.35, 0.8, 0.55, 1, 0.7, 0.4, 0.9, 0.6, 0.3, 0.75, 0.45, 0.85, 0.5, 0.3, 0.6, 0.35];

/** CSS-only waveform; animation lives in globals.css (.wave) and stops for reduced motion. */
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
  return (
    <div aria-hidden className={cn("wave flex h-8 items-center gap-[3px]", active && "wave-active", className)}>
      {PROFILE.slice(0, bars).map((h, i) => (
        <span
          key={i}
          className={cn("wave-bar h-full w-[3px] rounded-full bg-current", barClassName)}
          style={
            {
              "--h": h,
              "--d": `${1.1 + (i % 5) * 0.17}s`,
              "--delay": `${(i % 7) * 0.06}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
