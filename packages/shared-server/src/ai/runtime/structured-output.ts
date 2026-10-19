import type { z } from "zod";
import { asSchema } from "ai";

import type { AIProvider, DecisionProvider } from "@norish/config/zod/server-config";

/**
 * Providers reached through a base URL an operator typed, rather than a service
 * whose capabilities the SDK knows. What such an endpoint can actually serve is
 * decided by whatever sits behind it — an aggregator resolves a model to one of
 * several upstream providers — so it is the only place where asking for a
 * strict JSON schema may be refused by something that answers everything else
 * (#538).
 */
const OPENAI_COMPATIBLE_PROVIDERS: ReadonlySet<string> = new Set(["generic-openai", "lm-studio"]);

/** Whether a plain-JSON retry is available for this provider (#538). */
export function canDegradeToJsonMode(provider: AIProvider | DecisionProvider): boolean {
  return OPENAI_COMPATIBLE_PROVIDERS.has(provider);
}

/**
 * The instruction appended to a plain-JSON request: the schema travels in the
 * system message because the endpoint will not enforce it.
 *
 * Code-owned like the system messages, and appended to one rather than to the
 * administrator's prompt: it is an invariant of the transport, not an
 * instruction anyone should be able to edit away.
 */
export async function jsonModeInstruction<T>(schema: z.ZodType<T>): Promise<string> {
  const jsonSchema = await asSchema(schema).jsonSchema;

  return [
    "Answer with a single JSON object and nothing else: no prose, no code fence.",
    "It must validate against this JSON Schema:",
    JSON.stringify(jsonSchema),
  ].join("\n");
}
