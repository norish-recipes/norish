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

import { createModelsFromConfig } from "@norish/shared-server/ai/runtime/providers";
import { resetTemperatureFallbackCache } from "@norish/shared-server/ai/runtime/temperature-fallback";

/** Bodies of every request the provider made, newest last. */
let sentBodies: Record<string, unknown>[] = [];

/** Replies the stubbed transport hands out, in order; the last one repeats. */
let replies: (() => Response)[] = [];

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

/** A 400 Anthropic answers with, carrying `message` as its complaint. */
function anthropicRefusal(message: string): Response {
  return new Response(
    JSON.stringify({ type: "error", error: { type: "invalid_request_error", message } }),
    { status: 400, headers: { "content-type": "application/json" } }
  );
}

function generate(model: string): Promise<unknown> {
  const models = createModelsFromConfig({
    provider: "anthropic",
    model,
    apiKey: "test-key",
    timeoutMs: 5000,
  });

  return generateText({
    model: models.model,
    prompt: "hi",
    temperature: 0.2,
  });
}

async function generateWithTemperature(model: string): Promise<Record<string, unknown>> {
  await generate(model);

  return sentBodies.at(-1) ?? {};
}

beforeEach(() => {
  sentBodies = [];
  replies = [];
  resetTemperatureFallbackCache();

  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      sentBodies.push(JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>);

      const reply = replies.length > 1 ? replies.shift() : replies[0];

      return reply ? reply() : anthropicAnswer();
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

  it("is dropped and the request answered when the model refuses it", async () => {
    // A model the provider package forwards temperature for, refused by the
    // service anyway - the shape every model newer than the package has.
    replies = [
      () => anthropicRefusal("temperature is deprecated for this model."),
      anthropicAnswer,
    ];

    await expect(generate("claude-sonnet-4-5")).resolves.toBeDefined();

    expect(sentBodies.at(0)).toHaveProperty("temperature", 0.2);
    expect(sentBodies.at(-1)).not.toHaveProperty("temperature");
  });
});

describe("a recovery that fails too", () => {
  it("reports the model's own objection, not the recovery's", async () => {
    // The rejection test is a substring match, and Norish sends recipe text that
    // talks about oven temperature - so a 400 that merely mentions the word
    // starts a retry that was never going to help. The caller must still be told
    // what the model actually objected to.
    replies = [
      () => anthropicRefusal("temperature must be between 0 and 1"),
      () => anthropicRefusal("credit balance is too low"),
    ];

    const error = await generate("claude-sonnet-4-5").catch((err: unknown) => err);

    expect(String(error)).toContain("temperature must be between 0 and 1");
    expect(String((error as Error).cause)).toContain("credit balance is too low");
  });
});
