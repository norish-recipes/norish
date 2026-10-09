// @vitest-environment node
/**
 * The AI Runtime's third entry point (ADR-0024): generateImage reads the
 * Image Generation block rather than the server's AI provider, and returns
 * image bytes or a typed error that says whether retrying is worth it.
 * The provider is a local HTTP server speaking the OpenAI-compatible image
 * wire shape, beside the transcription runtime test.
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AIConfig, ImageGenerationConfig } from "@norish/config/zod/server-config";

const mockGetAIConfig = vi.fn();
const mockGetImageGenerationConfig = vi.fn();
const mockGetPrompts = vi.fn();

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getAIConfig: mockGetAIConfig,
  getImageGenerationConfig: mockGetImageGenerationConfig,
  getVideoConfig: vi.fn(),
  getPrompts: mockGetPrompts,
}));

vi.mock("@norish/shared-server/logger", () => {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  return { aiLogger: logger, serverLogger: logger, createLogger: () => logger };
});

const { generateImage } = await import("@norish/shared-server/ai/runtime/runtime");
const { createImageModelFromConfig } = await import("@norish/shared-server/ai/runtime/providers");
const { resetImageParameterFallback } =
  await import("@norish/shared-server/ai/runtime/image-parameter-fallback");
const { drawIngredientIcon } =
  await import("@norish/shared-server/ai/enrichment/ingredient-icon-drawer");
const { createModelUseLedger, runWithModelUseLedger } =
  await import("@norish/shared-server/ai/runtime/model-use-ledger");
const { AIConfigurationError, AIDisabledError, AIProviderError, AIResponseError } =
  await import("@norish/shared-server/ai/runtime/errors");

interface CapturedRequest {
  method: string;
  url: string;
  authorization: string | undefined;
  body: Record<string, unknown>;
}

let captured: CapturedRequest[] = [];
let reply: () => { status: number; body: unknown } = () => ({ status: 200, body: {} });
/** Headers a refusal for the rate limit carries, as OpenAI's do. */
let rateLimitHeaders: Record<string, string> = {};
let holdResponses = false;

const server = createServer((req, res) => {
  const chunks: Buffer[] = [];

  req.on("data", (chunk) => chunks.push(chunk as Buffer));
  req.on("end", () => {
    captured.push({
      method: req.method ?? "",
      url: req.url ?? "",
      authorization: req.headers.authorization,
      body: JSON.parse(Buffer.concat(chunks).toString() || "{}") as Record<string, unknown>,
    });

    if (holdResponses) return;

    const { status, body } = reply();

    res.statusCode = status;
    if (status === 429) {
      for (const [name, value] of Object.entries(rateLimitHeaders)) res.setHeader(name, value);
    }
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  });
});

let baseUrl = "";
let imageBase64 = "";

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  imageBase64 = (
    await sharp({ create: { width: 32, height: 18, channels: 3, background: "#a15829" } })
      .jpeg()
      .toBuffer()
  ).toString("base64");
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function aiConfig(overrides: Partial<AIConfig> = {}): AIConfig {
  return {
    enabled: true,
    provider: "anthropic",
    model: "claude-sonnet-5",
    temperature: 0.4,
    maxTokens: 4096,
    timeoutMs: 30_000,
    ...overrides,
  } as AIConfig;
}

function imageConfig(overrides: Partial<ImageGenerationConfig> = {}): ImageGenerationConfig {
  return {
    provider: "generic-openai",
    model: "test-image-model",
    endpoint: baseUrl,
    ...overrides,
  };
}

beforeEach(() => {
  resetImageParameterFallback();
  rateLimitHeaders = {};
  captured = [];
  holdResponses = false;
  reply = () => ({ status: 200, body: { data: [{ b64_json: imageBase64 }] } });
  mockGetAIConfig.mockResolvedValue(aiConfig());
  mockGetImageGenerationConfig.mockResolvedValue(imageConfig());
  mockGetPrompts.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("generateImage", () => {
  it("returns the provider's image bytes from the configured image provider", async () => {
    const result = await generateImage({
      prompt: "image-generation-style",
      sections: ["A rust-red stew in a wide bowl."],
    });

    expect(result.bytes.equals(Buffer.from(imageBase64, "base64"))).toBe(true);

    expect(captured).toHaveLength(1);
    expect(captured[0]!.url).toBe("/v1/images/generations");
    expect(captured[0]!.body.model).toBe("test-image-model");
    // The administrator's style prompt leads; the brief is appended after,
    // never interpolated (ADR-0016).
    const prompt = captured[0]!.body.prompt as string;

    expect(prompt).toMatch(/photograph of the dish/i);
    expect(prompt).toMatch(/A rust-red stew in a wide bowl\.$/);
  });

  it("asks for a landscape image", async () => {
    await generateImage({ prompt: "image-generation-style", sections: [] });

    const size = String(captured[0]!.body.size ?? "");
    const [width, height] = size.split("x").map(Number);

    expect(width).toBeGreaterThan(height ?? Number.NaN);
  });

  it("draws through Ollama's native generate route with a landscape width and height", async () => {
    // ai-sdk-ollama gained an image model on the AI SDK 7 line, so Ollama
    // joined the providers that can draw; it answers `images` rather than
    // the OpenAI-compatible `data[0].b64_json`.
    mockGetImageGenerationConfig.mockResolvedValue(
      imageConfig({ provider: "ollama", model: "x/z-image-turbo", endpoint: baseUrl })
    );
    reply = () => ({ status: 200, body: { model: "x/z-image-turbo", images: [imageBase64] } });

    const result = await generateImage({ prompt: "image-generation-style", sections: [] });

    expect(result.bytes.equals(Buffer.from(imageBase64, "base64"))).toBe(true);
    expect(captured).toHaveLength(1);
    expect(captured[0]!.url).toBe("/api/generate");
    expect(captured[0]!.body.model).toBe("x/z-image-turbo");
    expect(captured[0]!.body.width).toBe(1280);
    expect(captured[0]!.body.height).toBe(720);
  });

  it("refuses non-retryably when AI is disabled, without a request", async () => {
    mockGetAIConfig.mockResolvedValue(aiConfig({ enabled: false }));

    await expect(generateImage({ prompt: "image-generation-style" })).rejects.toBeInstanceOf(
      AIDisabledError
    );
    expect(captured).toHaveLength(0);
  });

  it.each([
    ["no stored block", null],
    ["a disabled provider", { provider: "disabled" } as Partial<ImageGenerationConfig>],
    ["a blank model", { model: " " } as Partial<ImageGenerationConfig>],
  ])("refuses non-retryably with %s, without a request", async (_case, stored) => {
    mockGetImageGenerationConfig.mockResolvedValue(stored === null ? null : imageConfig(stored));

    const failure = await generateImage({ prompt: "image-generation-style" }).then(
      () => null,
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(AIConfigurationError);
    expect((failure as InstanceType<typeof AIConfigurationError>).retryable).toBe(false);
    expect(captured).toHaveLength(0);
  });

  it("falls back to the AI configuration's endpoint and key when the provider matches", async () => {
    mockGetAIConfig.mockResolvedValue(
      aiConfig({ provider: "generic-openai", endpoint: baseUrl, apiKey: "ai-config-key" })
    );
    mockGetImageGenerationConfig.mockResolvedValue(
      imageConfig({ endpoint: undefined, apiKey: undefined })
    );

    await generateImage({ prompt: "image-generation-style" });

    expect(captured[0]!.authorization).toBe("Bearer ai-config-key");
  });

  it("records the image model on the job's ledger, a refusal as a failure", async () => {
    const ledger = createModelUseLedger();

    await runWithModelUseLedger(ledger, () => generateImage({ prompt: "image-generation-style" }));

    reply = () => ({ status: 400, body: { error: { message: "refused" } } });
    await runWithModelUseLedger(ledger, () =>
      generateImage({ prompt: "image-generation-style" }).catch(() => undefined)
    );

    expect(ledger.uses).toEqual([
      { provider: "generic-openai", model: "test-image-model", outcome: "completed" },
      { provider: "generic-openai", model: "test-image-model", outcome: "failed" },
    ]);
  });

  it("classifies a provider refusal as non-retryable", async () => {
    reply = () => ({
      status: 400,
      body: { error: { message: "content policy refusal", type: "invalid_request_error" } },
    });

    const failure = await generateImage({ prompt: "image-generation-style" }).then(
      () => null,
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(AIProviderError);
    expect((failure as InstanceType<typeof AIProviderError>).retryable).toBe(false);
  });

  it("classifies an empty response as retryable", async () => {
    reply = () => ({ status: 200, body: { data: [] } });

    const failure = await generateImage({ prompt: "image-generation-style" }).then(
      () => null,
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(AIResponseError);
    expect((failure as InstanceType<typeof AIResponseError>).retryable).toBe(true);
  });

  it("spends exactly one provider call per request: retrying is the queue's job", async () => {
    reply = () => ({ status: 503, body: { error: { message: "overloaded" } } });

    const failure = await generateImage({ prompt: "image-generation-style" }).then(
      () => null,
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(AIProviderError);
    expect((failure as InstanceType<typeof AIProviderError>).retryable).toBe(true);
    // Image calls are billed per request, so the SDK's silent in-call retries
    // are disabled; BullMQ's attempts are the one retry budget.
    expect(captured).toHaveLength(1);
  });

  it("gives up under the AI timeout rather than holding a worker", async () => {
    holdResponses = true;
    mockGetAIConfig.mockResolvedValue(aiConfig({ timeoutMs: 300 }));

    const startedAt = Date.now();
    const failure = await generateImage({ prompt: "image-generation-style" }).then(
      () => null,
      (error: unknown) => error
    );

    expect(Date.now() - startedAt).toBeLessThan(5_000);
    expect(failure).toBeInstanceOf(AIProviderError);
    expect((failure as InstanceType<typeof AIProviderError>).retryable).toBe(true);
  });

  describe("an Ingredient Icon", () => {
    it("is drawn square from its own prompt, the food and the composition appended", async () => {
      await drawIngredientIcon({ name: "pepper", kindOf: ["spice"] });

      expect(captured[0]!.body.size).toBe("1024x1024");
      const prompt = captured[0]!.body.prompt as string;

      // The administrator's icon style leads; the food follows, then the code's composition.
      expect(prompt).toMatch(/^A small icon of one food/);
      expect(prompt).toMatch(/The food: pepper, a kind of spice\.\n\n/);
      expect(prompt).toMatch(/one solid colour that the food itself does not contain/);
      expect(prompt).toMatch(/flour in a small bowl\.$/);
    });

    it("leaves quality alone where the provider has no tiers", async () => {
      await drawIngredientIcon({ name: "pepper", kindOf: [] });

      expect(captured[0]!.body).not.toHaveProperty("quality");
    });

    it.each([
      ["gpt-image-1-mini", "low"],
      ["gpt-image-2", "medium"],
    ] as const)("asks an OpenAI-family model (%s) for the %s tier", async (model, tier) => {
      // Azure's image model is OpenAI's and reaches a configured endpoint.
      mockGetImageGenerationConfig.mockResolvedValue(
        imageConfig({ provider: "azure", model, endpoint: baseUrl, apiKey: "azure-key" })
      );

      await drawIngredientIcon({ name: "pepper", kindOf: [] }, tier);

      expect(captured[0]!.body.quality).toBe(tier);
      expect(captured[0]!.body.size).toBe("1024x1024");
    });

    /** OpenAI's answer to a parameter a model does not take. */
    function refusing(parameter: string, message = `Unknown parameter: '${parameter}'.`) {
      return {
        status: 400,
        body: { error: { message, type: "invalid_request_error", param: parameter } },
      };
    }

    it("asks again without a parameter the model refuses, and leaves it out from then on", async () => {
      // gpt-6-luna draws, but the SDK adds response_format to a model it does not know, and it refuses it.
      mockGetImageGenerationConfig.mockResolvedValue(
        imageConfig({ provider: "azure", model: "gpt-6-luna", endpoint: baseUrl, apiKey: "k" })
      );
      reply = () =>
        "response_format" in (captured.at(-1)?.body ?? {})
          ? refusing("response_format")
          : { status: 200, body: { data: [{ b64_json: imageBase64 }] } };

      await drawIngredientIcon({ name: "pepper", kindOf: [] });
      expect(captured.map((request) => "response_format" in request.body)).toEqual([true, false]);

      // Learned: the next drawing asks without it straight away.
      await drawIngredientIcon({ name: "salt", kindOf: [] });
      expect(captured).toHaveLength(3);
      expect(captured[2]!.body).not.toHaveProperty("response_format");
      expect(captured[2]!.body.quality).toBe("low");
    });

    it("asks an OpenAI-family model for a transparent background, and a dish's picture for none", async () => {
      mockGetImageGenerationConfig.mockResolvedValue(
        imageConfig({
          provider: "azure",
          model: "gpt-image-1-mini",
          endpoint: baseUrl,
          apiKey: "k",
        })
      );

      await drawIngredientIcon({ name: "pepper", kindOf: [] });
      await generateImage({ prompt: "image-generation-style", sections: [] });

      expect(captured[0]!.body.background).toBe("transparent");
      expect(captured[1]!.body).not.toHaveProperty("background");
    });

    it("cuts the background away itself where the model refuses transparency", async () => {
      mockGetImageGenerationConfig.mockResolvedValue(
        imageConfig({ provider: "azure", model: "dall-e-3", endpoint: baseUrl, apiKey: "k" })
      );
      reply = () =>
        "background" in (captured.at(-1)?.body ?? {})
          ? refusing("background")
          : { status: 200, body: { data: [{ b64_json: imageBase64 }] } };

      await drawIngredientIcon({ name: "pepper", kindOf: [] });

      expect(captured.map((request) => request.body.background)).toEqual([
        "transparent",
        undefined,
      ]);
    });

    it("waits out the provider's rate limit, as long as it asks, and draws", async () => {
      let refusals = 1;

      reply = () =>
        refusals-- > 0
          ? { status: 429, body: { error: { message: "Rate limit reached", type: "requests" } } }
          : { status: 200, body: { data: [{ b64_json: imageBase64 }] } };
      rateLimitHeaders = { "retry-after-ms": "20" };

      const drawn = await drawIngredientIcon({ name: "pepper", kindOf: [] });

      expect(drawn.bytes.equals(Buffer.from(imageBase64, "base64"))).toBe(true);
      expect(captured).toHaveLength(2);
    });

    it("draws at the model's default where it refuses the tier", async () => {
      mockGetImageGenerationConfig.mockResolvedValue(
        imageConfig({ provider: "azure", model: "dall-e-3", endpoint: baseUrl, apiKey: "k" })
      );
      reply = () =>
        "quality" in (captured.at(-1)?.body ?? {})
          ? refusing("quality", "Invalid value: 'low'. Supported values are: 'standard' and 'hd'.")
          : { status: 200, body: { data: [{ b64_json: imageBase64 }] } };

      await drawIngredientIcon({ name: "pepper", kindOf: [] });

      expect(captured.map((request) => request.body.quality)).toEqual(["low", undefined]);
    });

    it("keeps a refusal of something it cannot go without", async () => {
      mockGetImageGenerationConfig.mockResolvedValue(
        imageConfig({ provider: "azure", model: "gpt-6-luna", endpoint: baseUrl, apiKey: "k" })
      );
      reply = () => refusing("size", "Invalid value: '1024x1024'.");

      await expect(drawIngredientIcon({ name: "pepper", kindOf: [] })).rejects.toBeInstanceOf(
        AIProviderError
      );
      expect(captured).toHaveLength(1);
    });

    it.each([
      ["openai", { size: "1024x1024" }, { openai: { quality: "low" } }],
      ["azure", { size: "1024x1024" }, { openai: { quality: "low" } }],
      ["google", { aspectRatio: "1:1" }, undefined],
      ["ollama", { size: "1024x1024" }, undefined],
      ["generic-openai", { size: "1024x1024" }, undefined],
    ] as const)(
      "asks %s for its square, and its cheapest tier where it has one",
      (provider, square, low) => {
        const model = createImageModelFromConfig({
          provider,
          model: provider === "openai" ? "gpt-image-1-mini" : "some-model",
          endpoint: baseUrl,
          apiKey: "key",
        });

        expect(model.square).toEqual(square);
        expect(model.preferences?.({ tier: "low" })).toEqual(low);
      }
    );

    it("keeps a dish's picture as it was: landscape, no tier", async () => {
      await generateImage({ prompt: "image-generation-style", sections: [] });

      expect(captured[0]!.body.size).not.toBe("1024x1024");
      expect(captured[0]!.body).not.toHaveProperty("quality");
    });
  });
});
