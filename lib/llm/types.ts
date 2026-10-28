import type { ZodType } from "zod";

export type Usage = { inputTokens: number; outputTokens: number };

export interface LLM {
  /** One structured call. Implementations validate against `schema` and retry once. */
  json<T>(opts: { system: string; prompt: string; schema: ZodType<T>; name: string }): Promise<{ data: T; usage: Usage }>;
  /** Plain-text streaming call. `onUsage` fires once at the end if the provider reports it. */
  stream(opts: { system: string; prompt: string; onUsage?: (u: Usage) => void }): AsyncIterable<string>;
}

export class LLMError extends Error {
  constructor(
    message: string,
    readonly code: "invalid_output" | "provider" | "not_configured",
  ) {
    super(message);
  }
}
