"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarDays } from "lucide-react";
import { useDemo } from "@/lib/store/demo";
import { formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export function CalendarPanel() {
  const events = useDemo((s) => s.events);
  const tz = useDemo((s) => s.tz);
  const [now] = useState(() => Date.now());

  const days = useMemo(() => {
    const upcoming = events
      .filter((e) => Date.parse(e.endISO) > now - 60 * 60_000)
      .sort((a, b) => Date.parse(a.startISO) - Date.parse(b.startISO))
      .slice(0, 12);
    const map = new Map<string, typeof upcoming>();
    for (const e of upcoming) {
      const k = formatInTimeZone(new Date(e.startISO), tz, "EEE d MMM");
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return [...map.entries()];
  }, [events, tz, now]);

  return (
    <section aria-labelledby="cal-title">
      <h2 id="cal-title" className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <CalendarDays className="size-4 text-ink-2" aria-hidden /> Your calendar
        <span className="ml-auto text-xs font-normal text-mute">{tz === "Asia/Kolkata" ? "IST" : tz}</span>
      </h2>
      <div className="space-y-3">
        {days.map(([day, list]) => (
          <div key={day}>
            <p className="text-xs font-medium text-mute">{day}</p>
            <ul className="mt-1 space-y-1">
              {list.map((e) => (
                <motion.li
                  key={e.id}
                  layout
                  initial={e.source === "sayso" ? { opacity: 0, scale: 0.97 } : false}
                  animate={{ opacity: 1, scale: 1 }}
                  className={cn(
                    "flex items-baseline gap-3 rounded-lg px-2.5 py-1.5 text-sm",
                    e.source === "sayso" ? "bg-signal-soft text-signal" : "bg-surface-2 text-ink-2",
                  )}
                >
                  <span className="w-16 shrink-0 text-xs tabular-nums">{formatTime(e.startISO, tz)}</span>
                  <span className="truncate">{e.title}</span>
                  {e.source === "sayso" && <span className="ml-auto shrink-0 text-[11px] font-medium">New</span>}
                </motion.li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
