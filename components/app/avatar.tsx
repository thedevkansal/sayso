import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-[#e6dcff] text-[#3b2a7a]",
  "bg-[#d8f0e2] text-[#1d5a37]",
  "bg-[#ffe3cf] text-[#7a3a12]",
  "bg-[#dbe7ff] text-[#1e3d8a]",
  "bg-[#f6dbe6] text-[#7a1f45]",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold",
        PALETTE[hash(name) % PALETTE.length],
        className,
      )}
    >
      {initials}
    </span>
  );
}
