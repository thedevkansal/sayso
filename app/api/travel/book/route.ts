import { z } from "zod";
import { json, log, preflight } from "@/lib/guard";
import { DuffelError, bookTestFlight, type TestPassenger } from "@/lib/travel/duffel";

const Body = z.object({ offerId: z.string().regex(/^off_[A-Za-z0-9]+$/) });

// Demo travellers. Fictional; no real personal data or payment details are ever collected.
// Distinct names: some airlines reject orders with identical passengers.
const person = (given: string, family: string, gender: "m" | "f", born: string, phone: string): TestPassenger => ({
  title: gender === "m" ? "mr" : "ms",
  gender,
  given_name: given,
  family_name: family,
  born_on: born,
  email: `${given.toLowerCase()}@aurora-summit.example`,
  phone_number: phone,
});
const DEMO_PASSENGERS: TestPassenger[] = [
  person("Asha", "Menon", "f", "1990-04-12", "+919800000001"),
  person("Rohan", "Iyer", "m", "1988-09-03", "+919800000002"),
  person("Meera", "Shah", "f", "1992-01-21", "+919800000003"),
  person("Kabir", "Rao", "m", "1985-06-30", "+919800000004"),
  person("Nisha", "Pillai", "f", "1994-11-08", "+919800000005"),
  person("Arjun", "Das", "m", "1991-02-14", "+919800000006"),
  person("Tara", "Kapoor", "f", "1989-07-19", "+919800000007"),
  person("Vikram", "Nair", "m", "1987-03-25", "+919800000008"),
  person("Ila", "Bose", "f", "1993-12-02", "+919800000009"),
];

export const maxDuration = 150;

export async function POST(req: Request) {
  const started = Date.now();
  const blocked = await preflight(req);
  if (blocked) return blocked;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request", message: "That booking request didn't look right." }, 400);

  try {
    const order = await bookTestFlight(parsed.data.offerId, DEMO_PASSENGERS);
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
      offer_request_already_booked: "This search was already used for a booking. Search again to book another flight.",
    };
    return json({ error: e.code, message: friendly[e.code] ?? e.message }, e.status >= 500 ? 502 : e.status);
  }
}
