"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { formatInTimeZone } from "date-fns-tz";
import { formatTime } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type GridEvent = {
  id: string;
  title: string;
  startISO: string;
  endISO: string;
  kind: "seed" | "sayso" | "proposed";
  /** Proposed events only: true when it overlaps something already booked. */
  clash?: boolean;
};

type Placed = GridEvent & { top: number; height: number; lane: number; lanes: number };

const minutesOfDay = (iso: string, tz: string) => {
  const [h, m] = formatInTimeZone(new Date(iso), tz, "HH:mm").split(":").map(Number);
  return h * 60 + m;
};

/** Greedy lane assignment inside each cluster of overlapping events, like Google Calendar. */
function layout(events: GridEvent[], day: string, tz: string, startHour: number, endHour: number, pxPerMin: number): Placed[] {
  const dayEvents = events
    .filter((e) => formatInTimeZone(new Date(e.startISO), tz, "yyyy-MM-dd") === day)
    .map((e) => {
      const s = Math.max(minutesOfDay(e.startISO, tz), startHour * 60);
      const rawEnd = minutesOfDay(e.endISO, tz);
      const endSameDay = formatInTimeZone(new Date(e.endISO), tz, "yyyy-MM-dd") === day ? rawEnd : 24 * 60;
      const end = Math.min(Math.max(endSameDay, s + 15), endHour * 60);
      return { e, s, end };
    })
    .filter((x) => x.s < endHour * 60)
    .sort((a, b) => a.s - b.s || b.end - a.end);

  const out: Placed[] = [];
  let cluster: { e: GridEvent; s: number; end: number; lane: number }[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    for (const c of cluster)
      out.push({ ...c.e, top: (c.s - startHour * 60) * pxPerMin, height: (c.end - c.s) * pxPerMin, lane: c.lane, lanes });
    cluster = [];
  };
  for (const x of dayEvents) {
    if (x.s >= clusterEnd && cluster.length) flush();
    const used = new Set(cluster.filter((c) => c.end > x.s).map((c) => c.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    cluster.push({ ...x, lane });
    clusterEnd = Math.max(clusterEnd, x.end);
  }
  if (cluster.length) flush();
  return out;
}

function hourLabel(h: number) {
  if (h === 0 || h === 24) return "12 am";
  if (h === 12) return "12 pm";
  return h < 12 ? `${h} am` : `${h - 12} pm`;
}

export function TimeGrid({
  days,
  events,
  tz,
  startHour = 7,
  endHour = 22,
  hourHeight = 48,
  scrollTo,
  showDayHeaders = true,
  className,
}: {
  days: string[];
  events: GridEvent[];
  tz: string;
  startHour?: number;
  endHour?: number;
  hourHeight?: number;
  /** ISO time to bring into view on mount/change. */
  scrollTo?: string | null;
  showDayHeaders?: boolean;
  className?: string;
}) {
  const pxPerMin = hourHeight / 60;
  const scroller = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const placed = useMemo(
    () => days.map((d) => layout(events, d, tz, startHour, endHour, pxPerMin)),
    [days, events, tz, startHour, endHour, pxPerMin],
  );

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const target = scrollTo ?? new Date(now).toISOString();
    const mins = minutesOfDay(target, tz) - startHour * 60 - 60;
    el.scrollTo({ top: Math.max(0, mins * pxPerMin), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-scroll when the target changes
  }, [scrollTo, days.join()]);

  const today = formatInTimeZone(new Date(now), tz, "yyyy-MM-dd");
  const nowMins = minutesOfDay(new Date(now).toISOString(), tz);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const totalHeight = hours.length * hourHeight;

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {showDayHeaders && days.length > 1 && (
        <div className="grid border-b border-line pl-12" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
          {days.map((d) => {
            const isToday = d === today;
            const date = new Date(`${d}T12:00:00Z`);
            return (
              <div key={d} className="flex flex-col items-center gap-0.5 py-2">
                <span className={cn("text-[11px] font-medium uppercase tracking-wide", isToday ? "text-signal" : "text-mute")}>
                  {formatInTimeZone(date, "UTC", "EEE")}
                </span>
                <span
                  className={cn(
                    "grid size-8 place-items-center rounded-full text-base font-semibold tabular-nums",
                    isToday ? "bg-signal text-white dark:text-[#0e0e0f]" : "text-ink",
                  )}
                >
                  {formatInTimeZone(date, "UTC", "d")}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div ref={scroller} className="relative min-h-0 flex-1 overflow-y-auto">
        <div className="relative flex" style={{ height: totalHeight }}>
          {/* hour gutter */}
          <div className="relative w-12 shrink-0" aria-hidden>
            {hours.map((h, i) => (
              <span
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-mute tabular-nums"
                style={{ top: i * hourHeight }}
              >
                {i === 0 ? "" : hourLabel(h)}
              </span>
            ))}
          </div>

          <div
            className="relative grid flex-1 border-l border-line"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          >
            {/* hour and half-hour lines */}
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              {hours.map((h, i) => (
                <div key={h}>
                  <div className="absolute inset-x-0 border-t border-line" style={{ top: i * hourHeight }} />
                  <div className="absolute inset-x-0 border-t border-dashed border-line/60" style={{ top: i * hourHeight + hourHeight / 2 }} />
                </div>
              ))}
            </div>

            {days.map((d, di) => (
              <div
                key={d}
                role="list"
                aria-label={formatInTimeZone(new Date(`${d}T12:00:00Z`), "UTC", "EEEE d MMMM")}
                className={cn("relative", di > 0 && "border-l border-line", d === today && days.length > 1 && "bg-signal-soft/25")}
              >
                {placed[di].map((e) => (
                  <EventBlock key={e.id} e={e} tz={tz} />
                ))}
                {d === today && nowMins >= startHour * 60 && nowMins <= endHour * 60 && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
                    style={{ top: (nowMins - startHour * 60) * pxPerMin }}
                    aria-label="Current time"
                  >
                    <span className="-ml-1 size-2 rounded-full bg-risk" />
                    <span className="h-px flex-1 bg-risk" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventBlock({ e, tz }: { e: Placed; tz: string }) {
  const short = e.height < 34;
  const gap = 2;
  return (
    <motion.div
      role="listitem"
      layout
      initial={e.kind === "seed" ? false : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "absolute z-10 overflow-hidden rounded-md border-l-[3px] px-1.5 text-[11px] leading-tight",
        e.kind === "seed" && "border-ink-2/50 bg-surface-2 text-ink-2 shadow-[0_0_0_1px_var(--line)]",
        e.kind === "sayso" && "border-signal bg-signal-soft text-signal shadow-[0_0_0_1px_color-mix(in_oklab,var(--signal),transparent_75%)]",
        e.kind === "proposed" &&
          (e.clash
            ? "z-20 border-2 border-dashed border-risk bg-risk-soft/80 text-risk"
            : "z-20 border-2 border-dashed border-signal bg-signal-soft/80 text-signal"),
        short ? "py-0.5" : "py-1",
      )}
      style={{
        top: e.top + 1,
        height: Math.max(e.height - gap, 16),
        left: `calc(${(e.lane / e.lanes) * 100}% + 2px)`,
        width: `calc(${100 / e.lanes}% - 4px)`,
      }}
      title={`${e.title}, ${formatTime(e.startISO, tz)}–${formatTime(e.endISO, tz)}`}
    >
      <p className={cn("truncate font-medium", short && "inline")}>
        {e.kind === "proposed" && <span className="mr-1 font-semibold">{e.clash ? "Clash ·" : "Proposed ·"}</span>}
        {e.title}
      </p>
      <p className={cn("truncate opacity-80 tabular-nums", short && "ml-1 inline")}>
        {formatTime(e.startISO, tz)}
        {!short && `–${formatTime(e.endISO, tz)}`}
      </p>
    </motion.div>
  );
}
