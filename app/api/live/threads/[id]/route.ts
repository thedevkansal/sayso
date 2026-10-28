import { json, log } from "@/lib/guard";
import { googleErrorResponse, googleToken } from "@/lib/google/client";
import { getThread } from "@/lib/google/gmail";

export async function GET(req: Request, ctx: RouteContext<"/api/live/threads/[id]">) {
  const started = Date.now();
  const session = await googleToken(req);
  if (session instanceof Response) return session;
  const { id } = await ctx.params;
  if (!/^[A-Za-z0-9]+$/.test(id)) return json({ error: "bad_request", message: "That thread id didn't look right." }, 400);
  try {
    const { thread, reply } = await getThread(session.accessToken, id, session.email);
    log("live_thread", { ok: true, ms: Date.now() - started, messages: thread.messages.length });
    // Participants stay server-side; the client only needs who the reply goes to.
    return json({ thread, reply: { replyTo: reply.replyTo, subject: reply.subject } });
  } catch (err) {
    log("live_thread", { ok: false, ms: Date.now() - started });
    return googleErrorResponse(err);
  }
}
