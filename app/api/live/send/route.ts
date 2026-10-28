import { z } from "zod";
import { checkRateLimit, clientIp, json, log } from "@/lib/guard";
import { googleErrorResponse, googleToken } from "@/lib/google/client";
import { getThread, sendReply } from "@/lib/google/gmail";
import { LIMITS } from "@/lib/schemas";

const Body = z.object({
  threadId: z.string().regex(/^[A-Za-z0-9]+$/),
  to: z.string().email().max(200),
  subject: z.string().min(1).max(LIMITS.subject),
  body: z.string().trim().min(1).max(20_000),
});

/**
 * Sends a reply in-thread. Only called from the confirm card after the user has seen the exact
 * recipient, subject and body. The recipient must already be a participant in the thread, so
 * nothing in an email (or a model) can redirect a reply elsewhere.
 */
export async function POST(req: Request) {
  const started = Date.now();
  const session = await googleToken(req);
  if (session instanceof Response) return session;
  if (!(await checkRateLimit(`send:${clientIp(req)}`)))
    return json({ error: "rate_limited", message: "Too many sends in a short time. Wait a few minutes." }, 429);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request", message: "That reply didn't look right." }, 400);
  const msg = parsed.data;

  try {
    const { reply } = await getThread(session.accessToken, msg.threadId, session.email);
    const to = msg.to.toLowerCase();
    if (!reply.participants.includes(to))
      return json({ error: "recipient_not_in_thread", message: "Replies can only go to people already in this thread." }, 400);

    const sent = await sendReply(session.accessToken, {
      threadId: msg.threadId,
      to,
      subject: msg.subject,
      body: msg.body,
      inReplyTo: reply.messageId,
      references: reply.references,
    });
    log("live_send", { ok: true, ms: Date.now() - started });
    return json({ id: sent.id, threadId: sent.threadId });
  } catch (err) {
    log("live_send", { ok: false, ms: Date.now() - started });
    return googleErrorResponse(err);
  }
}
