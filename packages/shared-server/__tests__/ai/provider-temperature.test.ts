// @vitest-environment node
/**
 * What actually reaches the provider when a temperature is configured.
 *
 * #514 was an `@ai-sdk/anthropic` too old to have heard of claude-sonnet-5: it
 * forwarded the configured temperature, Anthropic answered 400, and every
 * extraction died. The provider package that ships now leaves the parameter out
 * for the models that refuse it, so this asserts the request body rather than
 * the middleware - the version we depend on is the fix, and a downgrade that
 * quietly undoes it should fail here.
 */

import { generateText } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createModelsFromConfig } from "@norish/shared-server/ai/providers/factory";

/** Bodies of every request the provider made, newest last. */
let sentBodies: Record<string, unknown>[] = [];

function anthropicAnswer(): Response {
  return new Response(
    JSON.stringify({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-sonnet-5",
      content: [{ type: "text", text: "ok" }],
      stop_reason: "end_turn",
      usage: { input_tokens: 1, output_tokens: 1 },
    }),
    { status: 200, headers: { "content-type": "application/json" } }
  );
}

async function generateWithTemperature(model: string): Promise<Record<string, unknown>> {
  const models = createModelsFromConfig({
    provider: "anthropic",
    model,
    apiKey: "test-key",
    timeoutMs: 5000,
  });

  await generateText({
    model: models.model,
    prompt: "hi",
    temperature: 0.2,
  });

  return sentBodies.at(-1) ?? {};
}

beforeEach(() => {
  sentBodies = [];

  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      sentBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);

      return anthropicAnswer();
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("configured temperature", () => {
  it("is left out for a model that rejects it", async () => {
    const body = await generateWithTemperature("claude-sonnet-5");

    expect(body).not.toHaveProperty("temperature");
    expect(sentBodies).toHaveLength(1); // no rejected round trip to recover from
  });

  it("is still sent to a model that accepts it", async () => {
    const body = await generateWithTemperature("claude-sonnet-4-5");

    expect(body.temperature).toBe(0.2);
  });
});
