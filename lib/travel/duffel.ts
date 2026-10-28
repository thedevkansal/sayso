import "server-only";

/**
 * Duffel Flights API, test mode only. Plain fetch against the v2 API
 * (https://duffel.com/docs/api/overview/making-requests).
 */
const BASE = "https://api.duffel.com";

export class DuffelError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function token() {
  const t = process.env.DUFFEL_TEST_TOKEN;
  if (!t) throw new DuffelError("Flight search isn't set up on this deployment.", "not_configured", 503);
  // Hard stop on anything that isn't a test token: this demo must never book a real flight.
  if (!t.startsWith("duffel_test_")) throw new DuffelError("Only Duffel test tokens are allowed.", "not_test_token", 503);
  return t;
}

async function duffel<T>(path: string, init: { method?: string; body?: unknown; timeoutMs?: number } = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Duffel-Version": "v2",
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "Content-Type": "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(init.timeoutMs ?? 30_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const err = json?.errors?.[0];
    throw new DuffelError(err?.message ?? "Flight provider error", err?.code ?? `http_${res.status}`, res.status);
  }
  return json.data as T;
}

/* ---------- Types (subset of Duffel's schema we use) ---------- */
type Place = { iata_code: string; city_name?: string | null; name?: string };
type Segment = {
  departing_at: string;
  arriving_at: string;
  origin: Place;
  destination: Place;
  duration: string | null;
  marketing_carrier: { iata_code: string; name: string };
  marketing_carrier_flight_number: string;
};
type DuffelOffer = {
  id: string;
  total_amount: string;
  total_currency: string;
  expires_at: string;
  live_mode: boolean;
  owner: { name: string; iata_code: string; logo_symbol_url?: string | null };
  slices: { duration: string | null; segments: Segment[] }[];
  passengers: { id: string; type: string }[];
};

export type FlightOffer = {
  id: string;
  airline: string;
  airlineCode: string;
  logo: string | null;
  flightNumbers: string[];
  departAt: string; // local wall time at origin, no offset (as Duffel returns it)
  arriveAt: string;
  origin: string;
  destination: string;
  durationMinutes: number | null;
  stops: number;
  amount: string;
  currency: string;
  expiresAt: string;
};

function isoDurationToMinutes(d: string | null) {
  if (!d) return null;
  const m = d.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return null;
  return Number(m[1] ?? 0) * 1440 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

function simplify(o: DuffelOffer): FlightOffer {
  const slice = o.slices[0];
  const segs = slice.segments;
  return {
    id: o.id,
    airline: o.owner.name,
    airlineCode: o.owner.iata_code,
    logo: o.owner.logo_symbol_url ?? null,
    flightNumbers: segs.map((s) => `${s.marketing_carrier.iata_code}${s.marketing_carrier_flight_number}`),
    departAt: segs[0].departing_at,
    arriveAt: segs.at(-1)!.arriving_at,
    origin: segs[0].origin.iata_code,
    destination: segs.at(-1)!.destination.iata_code,
    durationMinutes: isoDurationToMinutes(slice.duration),
    stops: segs.length - 1,
    amount: o.total_amount,
    currency: o.total_currency,
    expiresAt: o.expires_at,
  };
}

const WINDOWS = {
  morning: { from: "05:00", to: "11:59" },
  afternoon: { from: "12:00", to: "16:59" },
  evening: { from: "17:00", to: "23:59" },
} as const;

export async function searchFlights(q: {
  origin: string;
  destination: string;
  date: string;
  timeOfDay: "morning" | "afternoon" | "evening" | "any";
  passengers: number;
}): Promise<FlightOffer[]> {
  const slice: Record<string, unknown> = { origin: q.origin, destination: q.destination, departure_date: q.date };
  if (q.timeOfDay !== "any") slice.departure_time = WINDOWS[q.timeOfDay];

  const data = await duffel<{ offers: DuffelOffer[] }>("/air/offer_requests?return_offers=true&supplier_timeout=15000", {
    method: "POST",
    body: {
      data: {
        slices: [slice],
        passengers: Array.from({ length: q.passengers }, () => ({ type: "adult" })),
        cabin_class: "economy",
        max_connections: 1,
      },
    },
    timeoutMs: 25_000,
  });

  let offers = data.offers.filter((o) => !o.live_mode);
  // Suppliers don't all honour departure_time (Duffel's test content ignores it), so filter again here.
  if (q.timeOfDay !== "any") {
    const { from, to } = WINDOWS[q.timeOfDay];
    const inWindow = offers.filter((o) => {
      const t = o.slices[0].segments[0].departing_at.slice(11, 16);
      return t >= from && t <= to;
    });
    if (inWindow.length) offers = inWindow;
  }
  // Cheapest first, then the five most useful distinct departures.
  offers.sort((a, b) => Number(a.total_amount) - Number(b.total_amount));
  const seen = new Set<string>();
  const out: FlightOffer[] = [];
  for (const o of offers) {
    const f = simplify(o);
    const key = `${f.departAt}-${f.flightNumbers.join()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
    if (out.length === 5) break;
  }
  return out;
}

export type TestPassenger = {
  title: "mr" | "ms" | "mrs";
  gender: "m" | "f";
  given_name: string;
  family_name: string;
  born_on: string;
  email: string;
  phone_number: string;
};

/** Re-fetches the offer for a current price, then creates an instant order paid from the test balance. */
export async function bookTestFlight(offerId: string, passengers: TestPassenger[]) {
  const offer = await duffel<DuffelOffer>(`/air/offers/${encodeURIComponent(offerId)}`);
  if (offer.live_mode) throw new DuffelError("Refusing to book a live offer.", "live_offer", 400);
  if (Date.parse(offer.expires_at) < Date.now())
    throw new DuffelError("That fare has expired. Search again for fresh prices.", "offer_expired", 422);

  const order = await duffel<{ id: string; booking_reference: string; total_amount: string; total_currency: string; live_mode: boolean }>(
    "/air/orders",
    {
      method: "POST",
      timeoutMs: 130_000,
      body: {
        data: {
          type: "instant",
          selected_offers: [offer.id],
          payments: [{ type: "balance", currency: offer.total_currency, amount: offer.total_amount }],
          passengers: offer.passengers.map((p, i) => ({ id: p.id, type: "adult", ...passengers[i % passengers.length] })),
        },
      },
    },
  );
  return { ...order, flight: simplify(offer) };
}
