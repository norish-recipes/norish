// @vitest-environment node
/**
 * The Decision Model's OpenAI-compatible provider: endpoint version paths,
 * the connection test's normalization, the factory's configuration errors,
 * and the structured-output request it sends.
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
const { createDecisionModelFromConfig } =
  await import("@norish/shared-server/ai/runtime/providers");

interface CapturedRequest {
  url: string;
  authorization: string | undefined;
  body: Record<string, unknown>;
}

let captured: CapturedRequest[] = [];
let reply: (body: Record<string, unknown>) => { status: number; body: unknown } = () => ({
  status: 200,
  body: completion("{}"),
});

const server = createServer((req, res) => {
  const chunks: Buffer[] = [];

  req.on("data", (chunk) => chunks.push(chunk as Buffer));
  req.on("end", () => {
    const body = JSON.parse(Buffer.concat(chunks).toString() || "{}") as Record<string, unknown>;

    captured.push({ url: req.url ?? "", authorization: req.headers.authorization, body });

    const answer = reply(body);

    res.statusCode = answer.status;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(answer.body));
  });
});

let baseUrl = "";

beforeAll(async () => {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function completion(content: string): unknown {
  return {
    id: "chatcmpl-test",
    created: 1,
    model: "my-model",
    choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  };
}

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

function genericConfig(overrides: Partial<DecisionConfig> = {}): DecisionConfig {
  return {
    provider: "generic-openai",
    apiKey: "generic-test-key",
    model: "my-model",
    endpoint: `${baseUrl}/api/v4`,
    ...overrides,
  };
}

const questions = { isTest: { type: "boolean", instructions: "Is this a test?" } } as const;

beforeEach(() => {
  captured = [];
  reply = () => ({
    status: 200,
    body: completion(JSON.stringify({ isTest: { probability: 0.97 } })),
  });
  mockGetAIConfig.mockResolvedValue(aiConfig());
  mockGetDecisionConfig.mockResolvedValue(genericConfig());
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("generic OpenAI-compatible Decision endpoints", () => {
  it.each([
    ["/api/v1", "/api/v1/chat/completions"],
    ["/api/v4", "/api/v4/chat/completions"],
    ["/api/v4/", "/api/v4/chat/completions"],
    ["/api/v1beta", "/api/v1beta/chat/completions"],
    ["/api/v1beta/", "/api/v1beta/chat/completions"],
    ["/api/v1alpha", "/api/v1alpha/chat/completions"],
    ["/api", "/api/v1/chat/completions"],
  ])("addresses %s at %s", async (endpoint, expected) => {
    mockGetDecisionConfig.mockResolvedValue(genericConfig({ endpoint: `${baseUrl}${endpoint}` }));

    const result = await decide({ feature: "provider-test", state: "test", questions });

    expect(result.answers.isTest).toEqual({ type: "boolean", probability: 0.97 });
    expect(captured).toHaveLength(1);
    expect(captured[0]!.url).toBe(expected);
    expect(captured[0]!.authorization).toBe("Bearer generic-test-key");
    expect(captured[0]!.body.model).toBe("my-model");
  });

  it("asks for a strict JSON schema first", async () => {
    await decide({ feature: "provider-test", state: "test", questions });

    const responseFormat = captured[0]!.body.response_format as {
      type: string;
      json_schema: { strict: boolean };
    };

    expect(responseFormat.type).toBe("json_schema");
    expect(responseFormat.json_schema.strict).toBe(true);
  });

  it("normalizes the distributions a language model returns", async () => {
    reply = () => ({
      status: 200,
      body: completion(
        JSON.stringify({
          mood: { probabilities: { calm: 0.2, busy: 0.6 } },
          completeness: { probabilities: { "0": 0.5, "1": 0.5 } },
        })
      ),
    });

    const result = await decide({
      feature: "provider-test",
      state: { title: "Lentil stew" },
      questions: {
        mood: {
          type: "choice",
          instructions: "How busy is the dish?",
          criteria: { calm: null, busy: null },
        },
        completeness: {
          type: "score",
          instructions: "How complete is the recipe?",
          criteria: ["incomplete", "complete"],
        },
      },
    });

    expect(result.answers.mood).toEqual({
      type: "choice",
      choice: "busy",
      probabilities: { calm: 0.25, busy: expect.closeTo(0.75, 10) },
    });
    expect(result.answers.completeness).toEqual({
      type: "score",
      score: 0.5,
      probabilities: { "0": 0.5, "1": 0.5 },
    });
  });

  it("retries a refused schema once in plain JSON mode, with the schema in the system message", async () => {
    reply = (body) => {
      const responseFormat = body.response_format as { type: string };

      return responseFormat.type === "json_schema"
        ? {
            status: 400,
            body: { error: { message: "response_format json_schema is not supported" } },
          }
        : { status: 200, body: completion(JSON.stringify({ isTest: { probability: 0.8 } })) };
    };

    const result = await decide({ feature: "provider-test", state: "test", questions });

    expect(result.answers.isTest).toEqual({ type: "boolean", probability: 0.8 });
    expect(
      captured.map((request) => (request.body.response_format as { type: string }).type)
    ).toEqual(["json_schema", "json_object"]);
    expect(JSON.stringify(captured[1]!.body.messages)).toContain("JSON Schema");
  });

  it("retries in plain JSON mode when a schema request answers with prose", async () => {
    reply = (body) => {
      const responseFormat = body.response_format as { type: string };

      return responseFormat.type === "json_schema"
        ? {
            status: 200,
            body: completion("The dish is most likely busy, with a fair chance of being calm."),
          }
        : {
            status: 200,
            body: completion(JSON.stringify({ mood: { probabilities: { calm: 0.2, busy: 0.6 } } })),
          };
    };

    const result = await decide({
      feature: "provider-test",
      state: { title: "Lentil stew" },
      questions: {
        mood: {
          type: "choice",
          instructions: "How busy is the dish?",
          criteria: { calm: null, busy: null },
        },
      },
    });

    expect(result.answers.mood).toEqual({
      type: "choice",
      choice: "busy",
      probabilities: { calm: 0.25, busy: expect.closeTo(0.75, 10) },
    });
    expect(
      captured.map((request) => (request.body.response_format as { type: string }).type)
    ).toEqual(["json_schema", "json_object"]);
  });
});

describe("testDecisionModel against a generic endpoint", () => {
  it("uses the same version-path normalization as a real Decision", async () => {
    const result = await testDecisionModel(genericConfig({ endpoint: `${baseUrl}/api/v4/` }));

    expect(result).toEqual({ success: true });
    expect(captured[0]!.url).toBe("/api/v4/chat/completions");
  });

  it("reports a missing key before any request", async () => {
    const result = await testDecisionModel(genericConfig({ apiKey: undefined }));

    expect(result.success).toBe(false);
    expect(result.error).toBe("An API key is required for the Decision Model provider.");
    expect(captured).toHaveLength(0);
  });

  it("reports a missing model before any request", async () => {
    const result = await testDecisionModel(genericConfig({ model: "" }));

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "A model is required for the generic OpenAI-compatible Decision provider."
    );
    expect(captured).toHaveLength(0);
  });

  it("reports a missing endpoint before any request", async () => {
    const result = await testDecisionModel(genericConfig({ endpoint: "" }));

    expect(result.success).toBe(false);
    expect(result.error).toBe(
      "An endpoint is required for the generic OpenAI-compatible Decision provider."
    );
    expect(captured).toHaveLength(0);
  });
});

describe("createDecisionModelFromConfig", () => {
  it("refuses a generic endpoint without a key or an endpoint", () => {
    expect(() =>
      createDecisionModelFromConfig({
        provider: "generic-openai",
        model: "my-model",
        endpoint: `${baseUrl}/api/v4`,
        timeoutMs: 1_000,
      })
    ).toThrow(/API Key is required/);

    expect(() =>
      createDecisionModelFromConfig({
        provider: "generic-openai",
        model: "my-model",
        endpoint: "",
        apiKey: "key",
        timeoutMs: 1_000,
      })
    ).toThrow(/Endpoint is required/);

    expect(() =>
      createDecisionModelFromConfig({
        provider: "generic-openai",
        model: " ",
        endpoint: `${baseUrl}/api/v4`,
        apiKey: "key",
        timeoutMs: 1_000,
      })
    ).toThrow(/Model is required/);
  });
});
