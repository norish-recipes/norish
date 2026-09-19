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
});
