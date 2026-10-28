import { AnalyzeRequestSchema } from "@/lib/schemas";
import { analyzeThread } from "@/lib/pipeline";
import { gemini } from "@/lib/llm/gemini";
import { LLMError } from "@/lib/llm/types";
import { json, log, preflight, recordSpend } from "@/lib/guard";

export async function POST(req: Request) {
  const started = Date.now();
  const blocked = await preflight(req);
  if (blocked) return blocked;

  const parsed = AnalyzeRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "bad_request", message: "That request didn't look right." }, 400);

  try {
    const result = await analyzeThread(gemini, parsed.data.thread);
    await recordSpend(result.usage);
    log("analyze", { ok: true, ms: Date.now() - started, asks: result.asks.length, flagged: result.suspicious.flagged });
    return json({ asks: result.asks, suspicious: result.suspicious, summary: result.summary });
  } catch (err) {
    const code = err instanceof LLMError ? err.code : "provider";
    log("analyze", { ok: false, ms: Date.now() - started, code });
    return json(
      {
        error: code,
        message:
          code === "not_configured"
            ? "The AI model isn't configured on this server. Set GEMINI_API_KEY in .env.local and restart."
            : "Couldn't read this thread just now. Try again in a moment.",
      },
      code === "not_configured" ? 503 : 502,
    );
  }
}
