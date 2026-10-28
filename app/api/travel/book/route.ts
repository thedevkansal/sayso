import { z } from "zod";
import { json, log, preflight } from "@/lib/guard";
import { DuffelError, bookTestFlight, type TestPassenger } from "@/lib/travel/duffel";

const Body = z.object({ offerId: z.string().regex(/^off_[A-Za-z0-9]+$/) });

// Demo traveller. Fictional; no real personal data or payment details are ever collected.
const DEMO_PASSENGER: TestPassenger = {
  title: "ms",
  gender: "f",
  given_name: "Asha",
  family_name: "Menon",
  born_on: "1990-04-12",
  email: "asha@aurora-summit.example",
  phone_number: "+919800000000",
};

export const maxDuration = 150;

export async function POST(req: Request) {
  const started = Date.now();
  const blocked = await preflight(req);
  if (blocked) return blocked;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request", message: "That booking request didn't look right." }, 400);

  try {
    const order = await bookTestFlight(parsed.data.offerId, [DEMO_PASSENGER]);
    log("travel_book", { ok: true, ms: Date.now() - started, live: order.live_mode });
    return json({
      orderId: order.id,
      reference: order.booking_reference,
      amount: order.total_amount,
      currency: order.total_currency,
      flight: order.flight,
      testMode: !order.live_mode,
    });
  } catch (err) {
    const e = err instanceof DuffelError ? err : new DuffelError("Booking failed. Try again.", "unknown", 502);
    log("travel_book", { ok: false, ms: Date.now() - started, code: e.code });
    const friendly: Record<string, string> = {
      offer_no_longer_available: "That fare is gone. Search again for fresh prices.",
      price_changed: "The price changed. Search again to see the new fare.",
      offer_expired: "That fare has expired. Search again for fresh prices.",
    };
    return json({ error: e.code, message: friendly[e.code] ?? e.message }, e.status >= 500 ? 502 : e.status);
  }
}
