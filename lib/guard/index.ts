import "server-only";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import type { Usage } from "@/lib/llm/types";

const PER_10_MIN = Number(process.env.RATE_LIMIT_PER_10MIN || 20);
const DAILY_CAP_USD = Number(process.env.DAILY_SPEND_CAP_USD || 5);
// Conservative per-million-token prices for the flash tier; override if the model changes.
const PRICE_IN = Number(process.env.LLM_PRICE_IN_PER_M || 0.5);
const PRICE_OUT = Number(process.env.LLM_PRICE_OUT_PER_M || 3);

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null;

const limiter = redis
  ? new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(PER_10_MIN, "10 m"), prefix: "sayso:rl" })
  : null;

// In-memory fallback: fine for local dev, per-instance only in production.
const memHits = new Map<string, number[]>();
let memSpend = { day: "", micros: 0 };

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function clientIp(req: Request) {
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}

export async function checkRateLimit(ip: string): Promise<boolean> {
  if (limiter) return (await limiter.limit(ip)).success;
  const now = Date.now();
  const window = 10 * 60_000;
  const hits = (memHits.get(ip) ?? []).filter((t) => now - t < window);
  if (hits.length >= PER_10_MIN) return false;
  hits.push(now);
  memHits.set(ip, hits);
  return true;
}

/** Spend is tracked in micro-dollars per UTC day. */
export async function underSpendCap(): Promise<boolean> {
  const capMicros = DAILY_CAP_USD * 1_000_000;
  if (redis) return Number((await redis.get<number>(`sayso:spend:${dayKey()}`)) ?? 0) < capMicros;
  if (memSpend.day !== dayKey()) memSpend = { day: dayKey(), micros: 0 };
  return memSpend.micros < capMicros;
}

export async function recordSpend(u: Usage) {
  const micros = Math.ceil(u.inputTokens * PRICE_IN + u.outputTokens * PRICE_OUT);
  if (micros <= 0) return;
  if (redis) {
    const key = `sayso:spend:${dayKey()}`;
    await redis.incrby(key, micros);
    await redis.expire(key, 60 * 60 * 48);
    return;
  }
  if (memSpend.day !== dayKey()) memSpend = { day: dayKey(), micros: 0 };
  memSpend.micros += micros;
}

/** Shared preflight for LLM endpoints. Returns a Response to short-circuit, or null to continue. */
export async function preflight(req: Request): Promise<Response | null> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > 120_000) return json({ error: "too_large", message: "That thread is too long for the demo." }, 413);
  if (!(await checkRateLimit(clientIp(req))))
    return json({ error: "rate_limited", message: "You're going a bit fast. Try again in a few minutes." }, 429);
  if (!(await underSpendCap()))
    return json({ error: "busy", message: "The demo is busy right now. Try again later." }, 503);
  return null;
}

export function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

/** Logs without content: route, outcome, timing. Never pass email text or dictation here. */
export function log(event: string, data: Record<string, string | number | boolean | null>) {
  console.info(JSON.stringify({ event, ...data }));
}
