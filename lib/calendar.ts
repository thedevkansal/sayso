import type { CalendarEvent } from "@/lib/seed";

export function conflictsFor(events: CalendarEvent[], startISO: string, endISO: string) {
  const s = Date.parse(startISO);
  const e = Date.parse(endISO);
  return events.filter((ev) => Date.parse(ev.startISO) < e && Date.parse(ev.endISO) > s);
}

/** First free slot of the same length after `startISO`, stepping in 15 minute increments, same day only. */
export function nextFreeSlot(events: CalendarEvent[], startISO: string, endISO: string) {
  const len = Date.parse(endISO) - Date.parse(startISO);
  let s = Date.parse(startISO);
  const dayEnd = s + 6 * 60 * 60_000;
  while (s < dayEnd) {
    s += 15 * 60_000;
    const start = new Date(s).toISOString();
    const end = new Date(s + len).toISOString();
    if (conflictsFor(events, start, end).length === 0) return { startISO: start, endISO: end };
  }
  return null;
}
