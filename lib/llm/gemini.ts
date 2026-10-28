import "server-only";
import { GoogleGenAI, type GenerateContentConfig, type ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { LLMError, type LLM, type Usage } from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

let client: GoogleGenAI | null = null;
function ai() {
  if (!process.env.GEMINI_API_KEY) throw new LLMError("GEMINI_API_KEY is not set", "not_configured");
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

function baseConfig(system: string): GenerateContentConfig {
  const level = process.env.GEMINI_THINKING_LEVEL as ThinkingLevel | undefined;
  return {
    systemInstruction: system,
    temperature: 0.2,
    ...(level ? { thinkingConfig: { thinkingLevel: level } } : {}),
  };
}

function usageOf(meta?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }): Usage {
  return {
    inputTokens: meta?.promptTokenCount ?? 0,
    outputTokens: (meta?.candidatesTokenCount ?? 0) + (meta?.thoughtsTokenCount ?? 0),
  };
}

export const gemini: LLM = {
  async json({ system, prompt, schema, name }) {
    const jsonSchema = z.toJSONSchema(schema, { target: "draft-7", io: "output" });
    delete (jsonSchema as Record<string, unknown>).$schema;

    const total: Usage = { inputTokens: 0, outputTokens: 0 };
    let lastIssue = "";

    for (let attempt = 0; attempt < 2; attempt++) {
      let text: string | undefined;
      try {
        const res = await ai().models.generateContent({
          model: MODEL,
          contents: attempt === 0 ? prompt : `${prompt}\n\nYour previous output was invalid (${lastIssue}). Return only JSON matching the schema.`,
          config: { ...baseConfig(system), responseMimeType: "application/json", responseJsonSchema: jsonSchema },
        });
        const u = usageOf(res.usageMetadata);
        total.inputTokens += u.inputTokens;
        total.outputTokens += u.outputTokens;
        text = res.text;
      } catch (err) {
        if (err instanceof LLMError) throw err;
        throw new LLMError(`${name}: provider error`, "provider");
      }

      try {
        const parsed = schema.safeParse(JSON.parse(text ?? ""));
        if (parsed.success) return { data: parsed.data, usage: total };
        lastIssue = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      } catch {
        lastIssue = "not valid JSON";
      }
    }
    throw new LLMError(`${name}: invalid output after retry`, "invalid_output");
  },

  async *stream({ system, prompt, onUsage }) {
    let res;
    try {
      res = await ai().models.generateContentStream({ model: MODEL, contents: prompt, config: baseConfig(system) });
    } catch (err) {
      if (err instanceof LLMError) throw err;
      throw new LLMError("reply: provider error", "provider");
    }
    let last: Usage | null = null;
    for await (const chunk of res) {
      if (chunk.usageMetadata) last = usageOf(chunk.usageMetadata);
      if (chunk.text) yield chunk.text;
    }
    if (last) onUsage?.(last);
  },
};
