import "server-only";
import { GoogleGenAI, type GenerateContentConfig, type ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { LLMError, type LLM, type Usage } from "./types";

// Primary model, then a lighter fallback used when the primary is overloaded (503) or too slow.
const MODELS = [
  process.env.GEMINI_MODEL || "gemini-3.5-flash",
  process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite",
].filter((m, i, all) => m && all.indexOf(m) === i);

const JSON_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 25_000);
const FIRST_TOKEN_TIMEOUT_MS = 15_000;

let client: GoogleGenAI | null = null;
function ai() {
  if (!process.env.GEMINI_API_KEY) throw new LLMError("GEMINI_API_KEY is not set", "not_configured");
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

function baseConfig(system: string, signal: AbortSignal): GenerateContentConfig {
  const level = (process.env.GEMINI_THINKING_LEVEL || "LOW") as ThinkingLevel;
  return {
    systemInstruction: system,
    temperature: 0.2,
    thinkingConfig: { thinkingLevel: level },
    abortSignal: signal,
  };
}

function usageOf(meta?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }): Usage {
  return {
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0),
  };
}

// Gemini rejects some valid JSON Schema (e.g. many maxItems bounds in one schema, ±2^53 int bounds)
// with a bare 400. The model only needs the shape; zod still enforces every bound on the way back.
const STRIP = new Set(["maxItems", "minItems", "minimum", "maximum", "additionalProperties", "$schema"]);
function forGemini(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(forGemini);
  if (node && typeof node === "object")
    return Object.fromEntries(
      Object.entries(node)
        .filter(([k]) => !STRIP.has(k))
        .map(([k, v]) => [k, forGemini(v)]),
    );
  return node;
}

/** Status-free description safe for logs (no prompt content). */
function errorKind(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (/abort|timeout/i.test(msg)) return "timeout";
  const code = msg.match(/"code":\s*(\d{3})|\b(4\d\d|5\d\d)\b/);
  return code ? `http_${code[1] ?? code[2]}` : "unknown";
}

export const gemini: LLM = {
  async json({ system, prompt, schema, name }) {
    const jsonSchema = forGemini(z.toJSONSchema(schema, { target: "draft-7", io: "output" }));

    const total: Usage = { inputTokens: 0, outputTokens: 0 };
    let lastIssue = "";
    let attemptsWithOutput = 0;

    for (const model of MODELS) {
      while (attemptsWithOutput < 2) {
        let text: string | undefined;
        try {
          const res = await ai().models.generateContent({
            model,
            contents:
              lastIssue === ""
                ? prompt
                : `${prompt}\n\nYour previous output was invalid (${lastIssue}). Return only JSON matching the schema.`,
            config: {
              ...baseConfig(system, AbortSignal.timeout(JSON_TIMEOUT_MS)),
              responseMimeType: "application/json",
              responseJsonSchema: jsonSchema,
            },
          });
          const u = usageOf(res.usageMetadata);
          total.inputTokens += u.inputTokens;
          total.outputTokens += u.outputTokens;
          text = res.text;
        } catch (err) {
          if (err instanceof LLMError) throw err;
          console.warn(JSON.stringify({ event: "llm_fallback", name, model, kind: errorKind(err) }));
          break; // try the next model
        }

        attemptsWithOutput++;
        try {
          const parsed = schema.safeParse(JSON.parse(text ?? ""));
          if (parsed.success) return { data: parsed.data, usage: total };
          lastIssue = parsed.error.issues
            .slice(0, 3)
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ");
        } catch {
          lastIssue = "not valid JSON";
        }
      }
      if (attemptsWithOutput >= 2) throw new LLMError(`${name}: invalid output after retry`, "invalid_output");
    }
    throw new LLMError(`${name}: provider error`, "provider");
  },

  async *stream({ system, prompt, onUsage }) {
    for (const model of MODELS) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FIRST_TOKEN_TIMEOUT_MS);
      let started = false;
      let last: Usage | null = null;
      try {
        const res = await ai().models.generateContentStream({ model, contents: prompt, config: baseConfig(system, ctrl.signal) });
        for await (const chunk of res) {
          if (!started) {
            started = true;
            clearTimeout(timer);
          }
          if (chunk.usageMetadata) last = usageOf(chunk.usageMetadata);
          if (chunk.text) yield chunk.text;
        }
        if (last) onUsage?.(last);
        return;
      } catch (err) {
        if (err instanceof LLMError) throw err;
        console.warn(JSON.stringify({ event: "llm_fallback", name: "reply", model, kind: errorKind(err) }));
        // Once text has reached the user, switching models would produce a mismatched email.
        if (started) throw new LLMError("reply: stream interrupted", "provider");
      } finally {
        clearTimeout(timer);
      }
    }
    throw new LLMError("reply: provider error", "provider");
  },
};
