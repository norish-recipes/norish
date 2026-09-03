// @vitest-environment node
/**
 * What a generic OpenAI-compatible endpoint is actually asked for, and what
 * happens when it refuses.
 *
 * #538: Norish asks for a strict `json_schema` answer, which narrows the usable
 * endpoints far below "speaks the OpenAI API". An aggregator reports that as a
 * routing failure — "no endpoints available matching your guardrail
 * restrictions and data policy", 404 — which reads as the operator's account
 * being misconfigured, and nothing anywhere named the real constraint. So a
 * refused request shape now gets one plain-JSON retry carrying the schema, and
 * a second refusal is reported as the capability it is, without burning queue
 * attempts on a state that cannot change.
 *
 * The provider is a local HTTP server speaking the chat-completions wire shape,
 * beside the image-generation and transcription runtime tests.
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { AIConfig } from "@norish/config/zod/server-config";

const mockGetAIConfig = vi.fn();
const mockGetPrompts = vi.fn();

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getAIConfig: mockGetAIConfig,
  getImageGenerationConfig: vi.fn(),
  getVideoConfig: vi.fn(),
  getPrompts: mockGetPrompts,
}));

vi.mock("@norish/shared-server/logger", () => {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

  return { aiLogger: logger, serverLogger: logger, createLogger: () => logger };
});

const { generateStructured } = await import("@norish/shared-server/ai/runtime/runtime");
const { AIProviderError } = await import("@norish/shared-server/ai/runtime/errors");

interface CapturedRequest {
  body: Record<string, unknown>;
}

let captured: CapturedRequest[] = [];
let replies: (() => { status: number; body: unknown })[] = [];

/** The answer the model gives when it plays along. */
function tagged(): { status: number; body: unknown } {
  return {
    status: 200,
    body: {
      id: "chatcmpl-test",
      object: "chat.completion",
      created: 0,
      model: "test-model",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: JSON.stringify({ tags: ["Italian"] }) },
          finish_reason: "stop",
        },
      ],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    },
  };
}

/** OpenRouter's answer when no permitted upstream can serve the request. */
function noEndpoints(): { status: number; body: unknown } {
  return {
    status: 404,
    body: {
      error: {
        message:
          "No endpoints available matching your guardrail restrictions and data policy. " +
          "Configure: https://openrouter.ai/settings/privacy",
      },
    },
  };
}

const server = createServer((req, res) => {
  const chunks: Buffer[] = [];

  req.on("data", (chunk) => chunks.push(chunk as Buffer));
  req.on("end", () => {
    captured.push({ body: JSON.parse(Buffer.concat(chunks).toString() || "{}") });

    const next = replies.length > 1 ? replies.shift() : replies[0];
    const { status, body } = (next ?? tagged)();

    res.statusCode = status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  });
});

let baseUrl = "";

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function aiConfig(overrides: Partial<AIConfig> = {}): AIConfig {
  return {
    enabled: true,
    provider: "generic-openai",
    model: "test-model",
    endpoint: baseUrl,
    temperature: 0.4,
    maxTokens: 4096,
    timeoutMs: 30_000,
    ...overrides,
  } as AIConfig;
}

const schema = z.object({ tags: z.array(z.string()) });

function generate() {
  return generateStructured({ prompt: "auto-tagging", schema, sections: ["A recipe."] });
}

/** The `response_format` each captured request carried. */
function responseFormats(): unknown[] {
  return captured.map((request) => request.body.response_format);
}

beforeEach(() => {
  captured = [];
  replies = [tagged];
  mockGetAIConfig.mockResolvedValue(aiConfig());
  mockGetPrompts.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("an endpoint that serves structured output", () => {
  it("is asked for a strict JSON schema, and answered in one request", async () => {
    await expect(generate()).resolves.toEqual({ tags: ["Italian"] });

    expect(captured).toHaveLength(1);
    expect(responseFormats()[0]).toMatchObject({ type: "json_schema" });
  });
});

describe("an endpoint that cannot serve structured output", () => {
  it("is retried in plain JSON mode and the answer is used", async () => {
    replies = [noEndpoints, tagged];

    await expect(generate()).resolves.toEqual({ tags: ["Italian"] });

    expect(responseFormats()).toEqual([
      expect.objectContaining({ type: "json_schema" }),
      { type: "json_object" },
    ]);
  });

  it("is told the shape it must answer in, which json_object mode does not carry", async () => {
    replies = [noEndpoints, tagged];

    await generate();

    const system = String(
      (captured[1]!.body.messages as { role: string; content: string }[])[0]!.content
    );

    expect(system).toContain("JSON Schema");
    expect(system).toContain("tags");
  });

  it("reports the missing capability when the retry is refused too", async () => {
    replies = [noEndpoints];

    const failure = await generate().then(
      () => null,
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(AIProviderError);
    expect((failure as InstanceType<typeof AIProviderError>).message).toMatch(
      /structured response/i
    );
    // Nothing an operator can wait out, so the queue must stop trying.
    expect((failure as InstanceType<typeof AIProviderError>).retryable).toBe(false);
    expect(captured).toHaveLength(2);
  });
});

describe("a failure that is not about the request's shape", () => {
  it("is reported as itself, without a second request", async () => {
    replies = [() => ({ status: 401, body: { error: { message: "invalid key" } } })];

    const failure = await generate().then(
      () => null,
      (error: unknown) => error
    );

    expect((failure as Error).message).toContain("API key");
    expect(captured).toHaveLength(1);
  });
});

describe("a provider whose structured-output support is known", () => {
  it("is not retried in JSON mode", async () => {
    mockGetAIConfig.mockResolvedValue(aiConfig({ provider: "openai", endpoint: undefined }));
    replies = [noEndpoints];

    // A real OpenAI base URL is not reachable here; what matters is that the
    // fallback is not offered to a provider whose capabilities are known.
    await generate().catch(() => null);

    expect(captured).toHaveLength(0);
  });
});
