import { z } from "zod";
import { checkRateLimit, clientIp, json, log } from "@/lib/guard";
import { googleErrorResponse, googleToken } from "@/lib/google/client";
import { createEvent, listEvents } from "@/lib/google/calendar";

export async function GET(req: Request) {
  const session = await googleToken(req);
  if (session instanceof Response) return session;
  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to || Number.isNaN(Date.parse(from)) || Number.isNaN(Date.parse(to)))
    return json({ error: "bad_request", message: "Missing date range." }, 400);
  if (Date.parse(to) - Date.parse(from) > 62 * 86_400_000) return json({ error: "bad_request", message: "Range too long." }, 400);
  try {
    return json({ events: await listEvents(session.accessToken, new Date(from).toISOString(), new Date(to).toISOString()) });
  } catch (err) {
    return googleErrorResponse(err);
  }
}

const Body = z.object({
  title: z.string().min(1).max(200),
  startISO: z.string().datetime(),
  endISO: z.string().datetime(),
  attendees: z.array(z.string().email()).max(10),
  tz: z.string().max(60),
});

/** Creates the event and emails invites to attendees. Only called from a confirm card. */
export async function POST(req: Request) {
  const started = Date.now();
  const session = await googleToken(req);
  if (session instanceof Response) return session;
  if (!(await checkRateLimit(`cal:${clientIp(req)}`)))
    return json({ error: "rate_limited", message: "Too many calendar changes in a short time. Wait a few minutes." }, 429);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request", message: "That event didn't look right." }, 400);
  const ev = parsed.data;
  if (Date.parse(ev.endISO) <= Date.parse(ev.startISO) || Date.parse(ev.startISO) < Date.now() - 60 * 60_000)
    return json({ error: "bad_request", message: "That time is in the past or invalid." }, 400);

  try {
    // Re-check for clashes server-side; the card already showed them, this guards against stale state.
    const clashes = await listEvents(session.accessToken, ev.startISO, ev.endISO);
    const created = await createEvent(session.accessToken, {
      ...ev,
      attendees: ev.attendees.filter((a) => a.toLowerCase() !== session.email),
    });
    log("live_calendar", { ok: true, ms: Date.now() - started, clashes: clashes.length });
    return json({ ...created, clashes: clashes.length });
  } catch (err) {
    log("live_calendar", { ok: false, ms: Date.now() - started });
    return googleErrorResponse(err);
  }
}
