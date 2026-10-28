"use client";

import { useMemo, useState } from "react";
import { addDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { CalendarDays, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { actionKey, useDemo } from "@/lib/store/demo";
import { conflictsFor } from "@/lib/calendar";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { TimeGrid, type GridEvent } from "./calendar/time-grid";

const dayKey = (d: Date, tz: string) => formatInTimeZone(d, tz, "yyyy-MM-dd");
const fromKey = (k: string) => new Date(`${k}T12:00:00Z`);

/** Monday-start week containing `day`. */
function weekOf(day: string) {
  const d = fromKey(day);
  const dow = (d.getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => addDays(d, i - dow).toISOString().slice(0, 10));
}

function useCalendarEvents() {
  const events = useDemo((s) => s.events);
  const selectedId = useDemo((s) => s.selectedId);
  const proposal = useDemo((s) => (s.selectedId ? s.proposals[s.selectedId] : undefined));
  const actionStatus = useDemo((s) => s.actionStatus);

  return useMemo(() => {
    const booked: GridEvent[] = events.map((e) => ({ ...e, kind: e.source }));
    const proposed: GridEvent[] =
      selectedId && proposal
        ? proposal.actions
            .filter((a) => a.type === "calendar_event")
            .filter((a) => !actionStatus[actionKey(selectedId, a.id)])
            .map((a) =>
              a.type === "calendar_event"
                ? {
                    id: `proposed-${a.id}`,
                    title: a.title,
                    startISO: a.startISO,
                    endISO: a.endISO,
                    kind: "proposed" as const,
                    clash: conflictsFor(events, a.startISO, a.endISO).length > 0,
                  }
                : null,
            )
            .filter((x): x is NonNullable<typeof x> => x !== null)
        : [];
    // Something this thread just booked (a call or a flight), most recent first.
    const fromThread = selectedId ? events.filter((e) => e.id.startsWith(`ev-${selectedId}:`)).at(-1) : undefined;
    return { all: [...booked, ...proposed], proposed, booked, fromThread };
  }, [events, proposal, selectedId, actionStatus]);
}

export function CalendarPanel() {
  const tz = useDemo((s) => s.tz);
  const { all, proposed, fromThread } = useCalendarEvents();
  const today = dayKey(new Date(), tz);
  const focusAt = proposed[0]?.startISO ?? fromThread?.startISO ?? null;
  const focusDay = focusAt ? dayKey(new Date(focusAt), tz) : today;

  // The user can browse days; a new proposal jumps the view to its day.
  const [picked, setPicked] = useState<{ day: string; forFocus: string } | null>(null);
  const day = picked && picked.forFocus === focusDay ? picked.day : focusDay;
  const setDay = (d: string) => setPicked({ day: d, forFocus: focusDay });
  const week = weekOf(day);
  const [weekOpen, setWeekOpen] = useState(false);

  const busyDays = useMemo(() => new Set(all.map((e) => dayKey(new Date(e.startISO), tz))), [all, tz]);
  const proposedDays = useMemo(() => new Set(proposed.map((e) => dayKey(new Date(e.startISO), tz))), [proposed, tz]);
  const scrollTarget = focusAt && dayKey(new Date(focusAt), tz) === day ? focusAt : null;

  return (
    <section aria-labelledby="cal-title" className="rounded-2xl border border-line bg-surface">
      <header className="flex items-center gap-1 border-b border-line px-3 py-2.5">
        <CalendarDays className="size-4 text-ink-2" aria-hidden />
        <h2 id="cal-title" className="ml-1 text-sm font-semibold text-ink">
          {formatInTimeZone(fromKey(day), "UTC", "MMMM yyyy")}
        </h2>
        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={() => setDay(today)}
            className="h-7 rounded-full border border-line px-2.5 text-xs text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Previous day"
            onClick={() => setDay(addDays(fromKey(day), -1).toISOString().slice(0, 10))}
            className="grid size-7 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next day"
            onClick={() => setDay(addDays(fromKey(day), 1).toISOString().slice(0, 10))}
            className="grid size-7 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
          >
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Open week view"
            onClick={() => setWeekOpen(true)}
            className="grid size-7 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
          >
            <Maximize2 className="size-3.5" />
          </button>
        </div>
      </header>

      {/* week strip */}
      <div className="grid grid-cols-7 gap-0.5 px-2 pt-2" role="tablist" aria-label="Days this week">
        {week.map((d) => {
          const selected = d === day;
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setDay(d)}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors",
                selected ? "bg-ink text-primary-foreground" : "hover:bg-surface-2",
              )}
            >
              <span className={cn("text-[10px] uppercase", selected ? "opacity-80" : isToday ? "text-signal" : "text-mute")}>
                {formatInTimeZone(fromKey(d), "UTC", "EEEEE")}
              </span>
              <span className={cn("text-sm font-semibold tabular-nums", !selected && (isToday ? "text-signal" : "text-ink"))}>
                {formatInTimeZone(fromKey(d), "UTC", "d")}
              </span>
              <span
                className={cn(
                  "size-1 rounded-full",
                  proposedDays.has(d) ? "bg-signal" : busyDays.has(d) ? (selected ? "bg-primary-foreground/60" : "bg-mute") : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>

      <p className="px-4 pt-3 pb-1 text-xs font-medium text-ink-2">
        {formatInTimeZone(fromKey(day), "UTC", "EEEE d MMMM")}
        {day === today && <span className="ml-1.5 text-signal">Today</span>}
      </p>
      <TimeGrid days={[day]} events={all} tz={tz} hourHeight={40} scrollTo={scrollTarget} className="h-[568px] pr-2 pb-2" />

      <Dialog open={weekOpen} onOpenChange={setWeekOpen}>
        <DialogContent className="flex h-[min(88dvh,52rem)] w-[min(96vw,72rem)] max-w-none flex-col gap-0 p-0 sm:max-w-none">
          <div className="flex items-center gap-2 border-b border-line px-5 py-3.5 pr-12">
            <DialogTitle className="text-base font-semibold text-ink">
              Week of {formatInTimeZone(fromKey(week[0]), "UTC", "d MMM")}
            </DialogTitle>
            <DialogDescription className="text-xs text-mute">
              Times in {tz === "Asia/Kolkata" ? "IST" : tz}. Dashed blocks are proposed and not booked yet.
            </DialogDescription>
            <div className="ml-auto flex items-center">
              <button
                type="button"
                aria-label="Previous week"
                onClick={() => setDay(addDays(fromKey(day), -7).toISOString().slice(0, 10))}
                className="grid size-8 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Next week"
                onClick={() => setDay(addDays(fromKey(day), 7).toISOString().slice(0, 10))}
                className="grid size-8 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
          <TimeGrid days={week} events={all} tz={tz} hourHeight={40} scrollTo={scrollTarget} className="min-h-0 flex-1" />
        </DialogContent>
      </Dialog>
    </section>
  );
}
