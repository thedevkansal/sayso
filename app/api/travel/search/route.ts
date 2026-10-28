import { z } from "zod";
import { json, log, preflight } from "@/lib/guard";
import { DuffelError, searchFlights } from "@/lib/travel/duffel";
import { toIata } from "@/lib/travel/airports";

const Body = z.object({
  origin: z.string().max(80),
  originCode: z.string().max(3).nullable(),
  destination: z.string().max(80),
  destinationCode: z.string().max(3).nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timeOfDay: z.enum(["morning", "afternoon", "evening", "any"]),
  passengers: z.number().int().min(1).max(9),
});

export async function POST(req: Request) {
  const started = Date.now();
  const blocked = await preflight(req);
  if (blocked) return blocked;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request", message: "That search didn't look right." }, 400);
  const q = parsed.data;

  const origin = toIata(q.originCode, q.origin);
  const destination = toIata(q.destinationCode, q.destination);
  if (!origin || !destination)
    return json({ error: "unknown_airport", message: `Couldn't find an airport for ${origin ? q.destination : q.origin}.` }, 422);
  if (origin === destination) return json({ error: "same_airport", message: "Origin and destination are the same." }, 422);

  try {
    const offers = await searchFlights({ origin, destination, date: q.date, timeOfDay: q.timeOfDay, passengers: q.passengers });
    log("travel_search", { ok: true, ms: Date.now() - started, offers: offers.length });
    return json({ origin, destination, offers });
  } catch (err) {
    const e = err instanceof DuffelError ? err : new DuffelError("Flight search failed. Try again.", "unknown", 502);
    log("travel_search", { ok: false, ms: Date.now() - started, code: e.code });
    return json({ error: e.code, message: e.message }, e.status >= 500 ? 502 : e.status);
  }
}
