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
import { createTypeSafeAi } from "@ai-sdk/typesafe-ai";
import { APICallError, experimental_evaluate, generateImage, generateText, Output } from "ai";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import type { FakeAIProvider } from "./ai-provider";
import { buildChatCompletionBody, createFakeAIProvider } from "./ai-provider";

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

describe("cleanup", () => {
  it("releases a held response when the provider stops", async () => {
    const heldProvider = createFakeAIProvider();

    await heldProvider.start();
    heldProvider.control.succeedWith({
      originCountryCode: null,
      cuisines: [],
      note: "Released during cleanup.",
    });
    heldProvider.control.hold();

    const response = fetch(`${heldProvider.url}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: "test-model", messages: [] }),
    });

    while (heldProvider.control.requestCount === 0) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const stopping = heldProvider.stop();
    const stoppedPromptly = await Promise.race([
      stopping.then(() => true),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), 500)),
    ]);

    try {
      expect(stoppedPromptly).toBe(true);
    } finally {
      heldProvider.control.release();
      await stopping;
      await response.catch(() => undefined);
    }
  });
});

describe("the image-generation route", () => {
  // The exact client the production image factory builds for generic-openai.
  function harnessImageModel() {
    const compatible = createOpenAICompatible({
      name: "generic-openai",
      baseURL: `${provider.url}/v1`,
    });

    return compatible.imageModel("test-image-model");
  }

  function drawImage() {
    return generateImage({
      model: harnessImageModel(),
      prompt: "A rust-red stew in a wide bowl.",
      size: "1280x720",
      maxRetries: 0,
    });
  }

  const IMAGE_BASE64 = Buffer.from("fake-jpeg-bytes").toString("base64");

  it("returns the directed image bytes through the real SDK client", async () => {
    provider.control.succeedImageWith(IMAGE_BASE64);

    const result = await drawImage();

    expect(Buffer.from(result.image.uint8Array).toString()).toBe("fake-jpeg-bytes");
    expect(provider.control.imageRequestCount).toBe(1);
    expect(provider.control.requests.at(-1)?.path).toBe("/v1/images/generations");
  });

  it("keeps the two routes' directives independent", async () => {
    provider.control.succeedWith({ note: "text answer" });
    provider.control.succeedImageWith(IMAGE_BASE64);

    const result = await drawImage();

    expect(Buffer.from(result.image.uint8Array).toString()).toBe("fake-jpeg-bytes");
  });

  it("can be directed to fail permanently like the chat route", async () => {
    provider.control.failImagePermanently("content policy refusal");

    const failure = await drawImage().then(
      () => null,
      (error: unknown) => error
    );

    expect(APICallError.isInstance(failure)).toBe(true);
    expect((failure as InstanceType<typeof APICallError>).statusCode).toBe(400);
    expect((failure as InstanceType<typeof APICallError>).isRetryable).toBe(false);
  });

  it("can be directed to fail retryably", async () => {
    provider.control.failImageRetryably();

    const failure = await drawImage().then(
      () => null,
      (error: unknown) => error
    );

    expect(APICallError.isInstance(failure)).toBe(true);
    expect((failure as InstanceType<typeof APICallError>).isRetryable).toBe(true);
  });

  it("fails loudly when no image directive is configured", async () => {
    provider.control.succeedWith({ note: "text answer" });

    const failure = await drawImage().then(
      () => null,
      (error: unknown) => error
    );

    expect(APICallError.isInstance(failure)).toBe(true);
    expect((failure as InstanceType<typeof APICallError>).statusCode).toBe(500);
  });
});

describe("the Decision route", () => {
  // The exact client the production runtime builds for the Decision block.
  function harnessDecisionModel() {
    return createTypeSafeAi({ apiKey: "e2e-key", baseURL: `${provider.url}/v1` }).evaluationModel(
      "jev-latest"
    );
  }

  function ask() {
    return experimental_evaluate({
      model: harnessDecisionModel(),
      state: { title: "Lentil stew" },
      questions: {
        Breakfast: { type: "boolean", instructions: "Is this a breakfast dish?" },
        mealtime: {
          type: "choice",
          instructions: "When is it eaten?",
          criteria: { lunch: null, dinner: null },
        },
      },
      maxRetries: 0,
    });
  }

  it("returns the directed answers through the real SDK provider", async () => {
    provider.control.decideWith(
      {
        Breakfast: { type: "noul", noul: 0.04 },
        mealtime: {
          type: "choice",
          choice: "dinner",
          confidence: 0.91,
          probabilities: { lunch: 0.1, dinner: 0.9 },
        },
      },
      "jev-2026-09-01"
    );

    const result = await ask();

    expect(result.answers.Breakfast).toEqual({ type: "boolean", probability: 0.04 });
    expect(result.answers.mealtime).toMatchObject({ type: "choice", choice: "dinner" });
    expect(result.response.modelId).toBe("jev-2026-09-01");
    expect(result.providerMetadata).toEqual({ typesafe: { confidence: { mealtime: 0.91 } } });
    expect(provider.control.decisionRequestCount).toBe(1);
    expect(provider.control.requests.at(-1)?.path).toBe("/v1/systemone");
  });

  it("consumes one-shot Decision directives before the default, independently of the chat lane", async () => {
    provider.control.succeedWith({ note: "text answer" });
    provider.control.decideWith({
      Breakfast: { type: "noul", noul: 0.9 },
      mealtime: { type: "choice", choice: "lunch", probabilities: { lunch: 1, dinner: 0 } },
    });
    provider.control.enqueueDecision({
      kind: "decision",
      answers: {
        Breakfast: { type: "noul", noul: 0.1 },
        mealtime: { type: "choice", choice: "dinner", probabilities: { lunch: 0, dinner: 1 } },
      },
    });

    const first = await ask();
    const second = await ask();

    expect(first.answers.Breakfast.probability).toBe(0.1);
    expect(second.answers.Breakfast.probability).toBe(0.9);
    expect(provider.control.decisionRequestCount).toBe(2);
  });

  it("can be directed to reject the key like a real 401", async () => {
    provider.control.failDecisionPermanently();

    const failure = await ask().then(
      () => null,
      (error: unknown) => error
    );

    expect(APICallError.isInstance(failure)).toBe(true);
    expect((failure as InstanceType<typeof APICallError>).statusCode).toBe(401);
    expect((failure as InstanceType<typeof APICallError>).isRetryable).toBe(false);
  });

  it("can be directed to fail retryably", async () => {
    provider.control.failDecisionRetryably();

    const failure = await ask().then(
      () => null,
      (error: unknown) => error
    );

    expect(APICallError.isInstance(failure)).toBe(true);
    expect((failure as InstanceType<typeof APICallError>).isRetryable).toBe(true);
  });

  it("fails loudly when no Decision directive is configured", async () => {
    provider.control.succeedWith({ note: "text answer" });

    const failure = await ask().then(
      () => null,
      (error: unknown) => error
    );

    expect(APICallError.isInstance(failure)).toBe(true);
    expect((failure as InstanceType<typeof APICallError>).statusCode).toBe(500);
  });
});
