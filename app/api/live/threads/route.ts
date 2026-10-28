import { json, log } from "@/lib/guard";
import { googleErrorResponse, googleToken } from "@/lib/google/client";
import { listInbox } from "@/lib/google/gmail";

export async function GET(req: Request) {
  const started = Date.now();
  const session = await googleToken(req);
  if (session instanceof Response) return session;
  try {
    const threads = await listInbox(session.accessToken);
    log("live_inbox", { ok: true, ms: Date.now() - started, count: threads.length });
    return json({ threads, me: { email: session.email, name: session.name } });
  } catch (err) {
    log("live_inbox", { ok: false, ms: Date.now() - started });
    return googleErrorResponse(err);
  }
}
