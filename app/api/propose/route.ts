import { ProposeRequestSchema } from "@/lib/schemas";
import { buildProposalCore, streamReply } from "@/lib/pipeline";
import { gemini } from "@/lib/llm/gemini";
import { LLMError } from "@/lib/llm/types";
import { json, log, preflight, recordSpend } from "@/lib/guard";

/**
 * NDJSON stream:
 *   {"type":"core", ...}       structured plan (facts, coverage, gaps, actions)
 *   {"type":"delta","text":…}  reply body tokens
 *   {"type":"done"} | {"type":"error","code","message"}
 */
export async function POST(req: Request) {
  const started = Date.now();
  const blocked = await preflight(req);
  if (blocked) return blocked;

  const parsed = ProposeRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request", message: "That request didn't look right." }, 400);
  const { thread, asks, transcript, tz, user } = parsed.data;
  const now = Number.isNaN(Date.parse(parsed.data.now)) ? new Date() : new Date(parsed.data.now);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const core = await buildProposalCore(gemini, { thread, asks, transcript, now, tz, user });
        await recordSpend(core.usage);
        send({
          type: "core",
          understoodFacts: core.understoodFacts,
          coverage: core.coverage,
          gaps: core.gaps,
          replySubject: core.replySubject,
          actions: core.actions,
          dropped: core.dropped,
        });

        for await (const text of streamReply(gemini, { thread, asks, core, tz, user, onUsage: (u) => void recordSpend(u) })) {
          if (req.signal.aborted) break;
          send({ type: "delta", text });
        }
        send({ type: "done" });
        log("propose", { ok: true, ms: Date.now() - started, actions: core.actions.length, dropped: core.dropped.length });
      } catch (err) {
        const code = err instanceof LLMError ? err.code : "provider";
        log("propose", { ok: false, ms: Date.now() - started, code });
        send({
          type: "error",
          code,
          message:
            code === "not_configured"
              ? "The AI model isn't configured on this server. Set GEMINI_API_KEY in .env.local and restart."
              : "Couldn't draft a reply just now. Your words are still here; try again.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
