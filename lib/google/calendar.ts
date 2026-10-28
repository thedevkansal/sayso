import "server-only";
import { google } from "./client";

const CAL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

type GEvent = {
  id: string;
  summary?: string;
  status?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  transparency?: string;
};

export type LiveEvent = { id: string; title: string; startISO: string; endISO: string };

/** Timed, busy events only; all-day and "free" events don't block a slot. */
export async function listEvents(token: string, fromISO: string, toISO: string): Promise<LiveEvent[]> {
  const qs = new URLSearchParams({
    timeMin: fromISO,
    timeMax: toISO,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const data = await google<{ items?: GEvent[] }>(token, `${CAL}?${qs}`);
  return (data.items ?? [])
    .filter((e) => e.status !== "cancelled" && e.transparency !== "transparent" && e.start?.dateTime && e.end?.dateTime)
    .map((e) => ({
      id: e.id,
      title: e.summary || "Busy",
      startISO: new Date(e.start!.dateTime!).toISOString(),
      endISO: new Date(e.end!.dateTime!).toISOString(),
    }));
}

export async function createEvent(
  token: string,
  ev: { title: string; startISO: string; endISO: string; attendees: string[]; tz: string },
) {
  const created = await google<GEvent & { htmlLink?: string }>(token, `${CAL}?sendUpdates=all`, {
    method: "POST",
    body: {
      summary: ev.title,
      start: { dateTime: ev.startISO, timeZone: ev.tz },
      end: { dateTime: ev.endISO, timeZone: ev.tz },
      attendees: ev.attendees.map((email) => ({ email })),
      description: "Scheduled with Sayso.",
    },
  });
  return { id: created.id, htmlLink: created.htmlLink ?? null };
}
