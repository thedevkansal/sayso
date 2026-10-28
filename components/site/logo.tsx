import Link from "next/link";
import { cn } from "@/lib/utils";

/** Five-bar waveform mark; the middle bar is the "say". */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("size-6", className)}>
      <rect width="24" height="24" rx="7" fill="currentColor" />
      <g fill="var(--canvas)">
        <rect x="4.5" y="10" width="2" height="4" rx="1" />
        <rect x="8" y="7.5" width="2" height="9" rx="1" />
        <rect x="11.5" y="5" width="2" height="14" rx="1" />
        <rect x="15" y="8" width="2" height="8" rx="1" />
        <rect x="18.5" y="10.5" width="2" height="3" rx="1" />
      </g>
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={cn("inline-flex items-center gap-2 rounded-md text-ink", className)}
      aria-label="Sayso home"
    >
      <LogoMark />
      <span className="text-[1.05rem] font-semibold tracking-[-0.03em]">sayso</span>
    </Link>
  );
}
