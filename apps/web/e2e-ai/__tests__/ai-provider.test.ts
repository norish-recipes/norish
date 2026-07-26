// @vitest-environment node
/**
 * Focused tests for the production-like AI E2E harness provider seam.
 *
 * These run in vitest without Docker, a browser, or a database: they prove the
 * fake provider is wire-compatible with the exact AI SDK client the production
 * server uses (`@ai-sdk/openai-compatible` + `generateText` + `Output.object`),
 * and that the harness can deterministically select success, permanent-failure,
 * and retryable-failure responses without contacting an external AI provider.
 */
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { APICallError, generateText, Output } from "ai";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import type { FakeAIProvider } from "../ai-provider";
import { buildChatCompletionBody, createFakeAIProvider } from "../ai-provider";

const schema = z
  .object({
    originCountryCode: z.string().nullable(),
    cuisines: z.array(z.string()),
    note: z.string(),
  })
  .strict();

let provider: FakeAIProvider;

/**
 * A model built exactly the way the production factory builds the
 * `generic-openai` provider (see packages/shared-server/.../factory.ts).
 */
function harnessModel() {
  const compatible = createOpenAICompatible({
    name: "generic-openai",
    baseURL: `${provider.url}/v1`,
    supportsStructuredOutputs: true,
  });

  return compatible("test-model");
}

function generate(maxRetries = 0) {
  return generateText({
    model: harnessModel(),
    output: Output.object({ schema }),
    prompt: "Infer provenance.",
    maxRetries,
  });
}

beforeAll(async () => {
  provider = createFakeAIProvider();
  await provider.start();
});

afterAll(async () => {
  await provider.stop();
});

beforeEach(() => {
  provider.control.reset();
});

describe("buildChatCompletionBody", () => {
  it("returns an OpenAI-shaped chat completion carrying the content verbatim", () => {
    const body = buildChatCompletionBody('{"ok":true}', "some-model");

    expect(body.object).toBe("chat.completion");
    expect(body.model).toBe("some-model");
    expect(body.choices[0]?.message).toEqual({ role: "assistant", content: '{"ok":true}' });
    expect(body.choices[0]?.finish_reason).toBe("stop");
    expect(body.usage).toBeDefined();
  });
});

describe("deterministic success", () => {
  it("flows a controlled structured response through the real AI SDK client", async () => {
    const canned = { originCountryCode: "IT", cuisines: ["Italian"], note: "Classic." };

    provider.control.succeedWith(canned);

    const result = await generate();

    expect(result.output).toEqual(canned);
    expect(provider.control.requestCount).toBe(1);
  });

  it("captures the outgoing request so scenarios can assert on it", async () => {
    provider.control.succeedWith({ originCountryCode: null, cuisines: [], note: "Unknown." });

    await generate();

    const [request] = provider.control.requests;

    expect(request?.path).toBe("/v1/chat/completions");
    expect(request?.body).toMatchObject({ model: "test-model" });
  });

  it("consumes one-shot enqueued responses in FIFO order before the default", async () => {
    provider.control.succeedWith({ originCountryCode: "FR", cuisines: ["French"], note: "d." });
    provider.control.enqueue({
      kind: "success",
      content: JSON.stringify({ originCountryCode: "JP", cuisines: ["Japanese"], note: "one." }),
    });

    const first = await generate();
    const second = await generate();

    expect(first.output.originCountryCode).toBe("JP");
    expect(second.output.originCountryCode).toBe("FR");
    expect(provider.control.requestCount).toBe(2);
  });
});

describe("deterministic permanent failure", () => {
  it("surfaces a non-retryable client error", async () => {
    provider.control.failPermanently("bad request");

    const error = await generate().then(
      () => null,
      (err: unknown) => err
    );

    expect(APICallError.isInstance(error)).toBe(true);
    expect((error as APICallError).statusCode).toBe(400);
    expect((error as APICallError).isRetryable).toBe(false);
  });
});

describe("deterministic retryable failure", () => {
  it("surfaces a retryable server error", async () => {
    provider.control.failRetryably("upstream down");

    const error = await generate().then(
      () => null,
      (err: unknown) => err
    );

    expect(APICallError.isInstance(error)).toBe(true);
    expect((error as APICallError).statusCode).toBe(503);
    expect((error as APICallError).isRetryable).toBe(true);
  });

  it("recovers when a retryable failure is followed by success", async () => {
    provider.control.succeedWith({ originCountryCode: "ES", cuisines: ["Spanish"], note: "ok." });
    provider.control.enqueue({ kind: "error", status: 503 });

    const result = await generate(2);

    expect(result.output.originCountryCode).toBe("ES");
    expect(provider.control.requestCount).toBe(2);
  });
});

describe("invalid structured output", () => {
  it("returns a 200 whose body cannot satisfy the schema", async () => {
    provider.control.respondInvalid("not json at all");

    const error = await generate().then(
      () => null,
      (err: unknown) => err
    );

    expect(error).not.toBeNull();
    expect(provider.control.requestCount).toBe(1);
  });
});
