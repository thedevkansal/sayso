import "server-only";
import { getToken } from "next-auth/jwt";
import { json } from "@/lib/guard";

export class GoogleError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
  }
}

export type GoogleSession = { accessToken: string; email: string; name: string };

/**
 * Reads the Google access token from the encrypted session cookie.
 * Returns a Response to send back when the user isn't connected or the token is stale.
 * getToken() only decodes the cookie; refreshing happens when the client hits /api/auth/session
 * (the jwt callback in auth.ts), so a stale token answers `token_expired` and the client retries.
 */
export async function googleToken(req: Request): Promise<GoogleSession | Response> {
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: new URL(req.url).protocol === "https:",
  });
  const t = token as (typeof token & { accessToken?: string; error?: string; expiresAt?: number }) | null;
  if (!t?.accessToken)
    return json({ error: "not_connected", message: "Connect your Google account to use live mode." }, 401);
  if (t.error === "refresh_failed")
    return json({ error: "reconnect", message: "Your Google session expired. Connect again to continue." }, 401);
  if (t.expiresAt && Date.now() / 1000 > t.expiresAt - 30)
    return json({ error: "token_expired", message: "Refreshing your Google session." }, 401);
  return { accessToken: t.accessToken, email: (t.email ?? "").toLowerCase(), name: t.name ?? t.email ?? "" };
}

export async function google<T>(
  accessToken: string,
  url: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const status = res.status;
    const message =
      status === 401
        ? "Your Google session expired. Connect again to continue."
        : status === 403
          ? "Sayso doesn't have permission for that. Reconnect and allow all requested access."
          : (data?.error?.message ?? "Google request failed.");
    throw new GoogleError(message, status, status === 401 ? "reconnect" : status === 403 ? "forbidden" : "google_error");
  }
  return (res.status === 204 ? null : await res.json()) as T;
}

export function googleErrorResponse(err: unknown) {
  if (err instanceof GoogleError) return json({ error: err.code, message: err.message }, err.status === 401 ? 401 : err.status === 403 ? 403 : 502);
  return json({ error: "google_error", message: "Google request failed. Try again." }, 502);
}
