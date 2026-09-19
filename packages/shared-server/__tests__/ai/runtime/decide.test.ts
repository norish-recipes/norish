// @vitest-environment node
/**
 * The AI Runtime's fourth entry point (ADR-0035): decide reads the Decision
 * block rather than the server's AI provider, asks every question in one
 * request, and returns typed answers with their full distributions or a
 * typed error that says whether retrying is worth it. The provider is a
 * local HTTP server speaking TypeSafe's wire shape, beside the image and
 * structured-output runtime tests.
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AIConfig, DecisionConfig } from "@norish/config/zod/server-config";

const mockGetAIConfig = vi.fn();
const mockGetDecisionConfig = vi.fn();
const logger = vi.hoisted(() => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getAIConfig: mockGetAIConfig,
  getDecisionConfig: mockGetDecisionConfig,
  getImageGenerationConfig: vi.fn(),
  getVideoConfig: vi.fn(),
  getPrompts: vi.fn(),
}));

vi.mock("@norish/shared-server/logger", () => ({
  aiLogger: logger,
  serverLogger: logger,
  createLogger: () => logger,
}));

const { decide, testDecisionModel } = await import("@norish/shared-server/ai/runtime/runtime");
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
    provider: "anthropic",
    model: "claude-sonnet-5",
    temperature: 0.4,
    maxTokens: 4096,
    timeoutMs: 30_000,
    ...overrides,
  } as AIConfig;
}

function decisionConfig(overrides: Partial<DecisionConfig> = {}): DecisionConfig {
  return { provider: "typesafe", apiKey: "ts-test-key", endpoint: baseUrl, ...overrides };
}

/** The three question shapes, as a feature would write them. */
const questions = {
  mealtime: {
    type: "choice",
    instructions: "When is this dish eaten?",
    criteria: { breakfast: "Morning", dinner: "Evening", snack: null },
  },
  completeness: {
    type: "score",
    instructions: "How complete is the recipe?",
    criteria: ["incomplete", "usable", "complete"],
  },
  isVegetarian: { type: "boolean", instructions: "Is this recipe vegetarian?" },
} as const;

/** TypeSafe's answer when it plays along. */
function answered(): { status: number; body: unknown } {
  return {
    status: 200,
    body: {
      model: "jev-2026-09-01",
      answers: {
        mealtime: {
          type: "choice",
          choice: "dinner",
          confidence: 0.91,
          probabilities: { breakfast: 0.05, dinner: 0.9, snack: 0.05 },
        },
        completeness: {
          type: "score",
          score: 1.6,
          confidence: 0.8,
          probabilities: { "0": 0.1, "1": 0.2, "2": 0.7 },
        },
        isVegetarian: { type: "noul", noul: 0.97 },
      },
      usage: { input_tokens: 120, output_tokens: 0 },
    },
  };
}

const state = { title: "Lentil stew", ingredients: ["lentils", "carrot", "onion"] };

function ask() {
  return decide({ feature: "runtime-test", state, questions });
}

beforeEach(() => {
  captured = [];
  holdResponses = false;
  reply = answered;
  mockGetAIConfig.mockResolvedValue(aiConfig());
  mockGetDecisionConfig.mockResolvedValue(decisionConfig());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("decide", () => {
  it("asks every question in one request against TypeSafe's wire shape", async () => {
    await ask();

    expect(captured).toHaveLength(1);
    expect(captured[0]!.method).toBe("POST");
    expect(captured[0]!.url).toBe("/v1/systemone");
    expect(captured[0]!.authorization).toBe("Bearer ts-test-key");
    expect(captured[0]!.body.model).toBe("jev-latest");
    expect(captured[0]!.body.state).toEqual(state);

    const asked = captured[0]!.body.questions as Record<string, { type: string }>;

    expect(Object.keys(asked)).toEqual(["mealtime", "completeness", "isVegetarian"]);
    // A Boolean rides TypeSafe's Noul primitive on the wire.
    expect(asked.isVegetarian!.type).toBe("noul");
  });

  it("returns each pick with its full distribution and confidence, as-is", async () => {
    const result = await ask();

    expect(result.model).toBe("jev-2026-09-01");
    expect(result.answers.mealtime).toEqual({
      type: "choice",
      choice: "dinner",
      probabilities: { breakfast: 0.05, dinner: 0.9, snack: 0.05 },
      confidence: 0.91,
    });
    expect(result.answers.completeness).toEqual({
      type: "score",
      score: 1.6,
      probabilities: { "0": 0.1, "1": 0.2, "2": 0.7 },
      confidence: 0.8,
    });
    expect(result.answers.isVegetarian).toEqual({ type: "boolean", probability: 0.97 });
  });

  it("uses the block's own model and endpoint when set", async () => {
    mockGetDecisionConfig.mockResolvedValue(decisionConfig({ model: "jev-2026-09-01" }));

    await ask();

    expect(captured[0]!.body.model).toBe("jev-2026-09-01");
  });

  it("refuses non-retryably when AI is disabled, without a request", async () => {
    mockGetAIConfig.mockResolvedValue(aiConfig({ enabled: false }));

    await expect(ask()).rejects.toBeInstanceOf(AIDisabledError);
    expect(captured).toHaveLength(0);
  });

  it.each([
    ["no stored block", null],
    ["a disabled provider", { provider: "disabled" } as Partial<DecisionConfig>],
    ["no key", { apiKey: undefined } as Partial<DecisionConfig>],
  ])("refuses non-retryably with %s, without a request", async (_case, stored) => {
    mockGetDecisionConfig.mockResolvedValue(stored === null ? null : decisionConfig(stored));

    const failure = await ask().then(
      () => null,
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(AIConfigurationError);
    expect((failure as InstanceType<typeof AIConfigurationError>).retryable).toBe(false);
    expect((failure as Error).message).toMatch(/No Decision Model is configured/);
    expect(captured).toHaveLength(0);
  });

  it("classifies a missing answer as retryable", async () => {
    reply = () => {
      const { body } = answered() as { body: { answers: Record<string, unknown> } };

      delete body.answers.isVegetarian;

      return { status: 200, body };
    };

    const failure = await ask().then(
      () => null,
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(AIResponseError);
    expect((failure as InstanceType<typeof AIResponseError>).retryable).toBe(true);
  });

  it("classifies a distribution that does not add up as retryable", async () => {
    reply = () => {
      const { body } = answered() as {
        body: { answers: { mealtime: { probabilities: Record<string, number> } } };
      };

      body.answers.mealtime.probabilities = { breakfast: 0.5, dinner: 0.9, snack: 0.05 };

      return { status: 200, body };
    };

    const failure = await ask().then(
      () => null,
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(AIResponseError);
  });

  it("classifies a rejected key as non-retryable", async () => {
    reply = () => ({ status: 401, body: { message: "invalid api key" } });

    const failure = await ask().then(
      () => null,
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(AIProviderError);
    expect((failure as InstanceType<typeof AIProviderError>).retryable).toBe(false);
  });

  it("classifies a rate limit as retryable and spends exactly one provider call", async () => {
    reply = () => ({ status: 429, body: { message: "slow down" } });

    const failure = await ask().then(
      () => null,
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(AIProviderError);
    expect((failure as InstanceType<typeof AIProviderError>).retryable).toBe(true);
    // The SDK's silent in-call retries are off; the queue's attempts are the
    // one retry budget.
    expect(captured).toHaveLength(1);
  });

  it("gives up under the AI timeout rather than holding a worker", async () => {
    holdResponses = true;
    mockGetAIConfig.mockResolvedValue(aiConfig({ timeoutMs: 300 }));

    const startedAt = Date.now();
    const failure = await ask().then(
      () => null,
      (error: unknown) => error
    );

    expect(Date.now() - startedAt).toBeLessThan(5_000);
    expect(failure).toBeInstanceOf(AIProviderError);
    expect((failure as InstanceType<typeof AIProviderError>).retryable).toBe(true);
  });

  it("logs one info line per Decision with the usage fields, and never the state", async () => {
    await ask();

    const completed = logger.info.mock.calls.find(
      ([, message]) => message === "Decision completed"
    );

    expect(completed?.[0]).toEqual({
      feature: "runtime-test",
      provider: "TypeSafe AI",
      model: "jev-2026-09-01",
      questions: 3,
      inputTokens: 120,
      outputTokens: 0,
    });

    const infoPayloads = JSON.stringify(logger.info.mock.calls.map(([fields]) => fields));

    expect(infoPayloads).not.toContain("Lentil stew");
  });
});

describe("testDecisionModel", () => {
  it("asks one Boolean question against the settings as typed", async () => {
    mockGetDecisionConfig.mockResolvedValue(null);
    reply = () => ({
      status: 200,
      body: { model: "jev-2026-09-01", answers: { isTest: { type: "noul", noul: 0.99 } } },
    });

    const result = await testDecisionModel({
      provider: "typesafe",
      apiKey: "typed",
      endpoint: baseUrl,
    });

    expect(result).toEqual({ success: true });
    expect(captured[0]!.authorization).toBe("Bearer typed");
    expect(captured[0]!.body.state).toBe("test");
  });

  it("reports a rejected key as a rejected key", async () => {
    reply = () => ({ status: 401, body: { message: "invalid api key" } });

    const result = await testDecisionModel({
      provider: "typesafe",
      apiKey: "bad",
      endpoint: baseUrl,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/rejected the API key/);
  });

  it("explains that AI is off rather than sending a request", async () => {
    mockGetAIConfig.mockResolvedValue(aiConfig({ enabled: false }));

    const result = await testDecisionModel({
      provider: "typesafe",
      apiKey: "k",
      endpoint: baseUrl,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/disabled/i);
    expect(captured).toHaveLength(0);
  });
});
