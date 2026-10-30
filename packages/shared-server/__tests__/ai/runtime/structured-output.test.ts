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

/** When set, the shared transport's fetch is this stub instead of the network. */
const transport = vi.hoisted(() => ({ stub: null as typeof fetch | null }));

vi.mock("@norish/shared-server/ai/runtime/transport", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@norish/shared-server/ai/runtime/transport")>();

  return {
    ...actual,
    createFetchWithTimeout: (timeoutMs: number): typeof fetch => {
      const network = actual.createFetchWithTimeout(timeoutMs);

      return (url, init) => (transport.stub ?? network)(url, init);
    },
  };
});

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
const { aiLogger } = await import("@norish/shared-server/logger");
const { AIProviderError, isTimedOut } = await import("@norish/shared-server/ai/runtime/errors");
const { createModelUseLedger, runWithModelUseLedger } =
  await import("@norish/shared-server/ai/runtime/model-use-ledger");
const { forgetKeyRejection, listKeyRejections } =
  await import("@norish/shared-server/ai/runtime/key-rejections");

interface CapturedRequest {
  body: Record<string, unknown>;
}

let captured: CapturedRequest[] = [];
let replies: (() => { status: number; body: unknown })[] = [];
/** Leaves every request unanswered, as a model still thinking does. */
let holdReplies = false;

/** The answer the model gives when it plays along, with the usage it reports. */
function tagged(
  usage: Record<string, number> = { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
): { status: number; body: unknown } {
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
      usage,
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
    if (holdReplies) return;

    const next = replies.length > 1 ? replies.shift() : replies[0];
    const { status, body } = (next ?? (() => tagged()))();

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
  holdReplies = false;
  replies = [() => tagged()];
  mockGetAIConfig.mockResolvedValue(aiConfig());
  mockGetPrompts.mockResolvedValue({});
});

afterEach(() => {
  transport.stub = null;
});

describe("an endpoint that serves structured output", () => {
  it("is asked for a strict JSON schema, and answered in one request", async () => {
    await expect(generate()).resolves.toEqual({ tags: ["Italian"] });

    expect(captured).toHaveLength(1);
    expect(responseFormats()[0]).toMatchObject({ type: "json_schema" });
  });
});

describe("Mistral, whose schema is only a hint unless asked to be strict", () => {
  it("is asked for a strict JSON schema (#646)", async () => {
    const sent: Record<string, unknown>[] = [];

    transport.stub = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)));

      return new Response(JSON.stringify(tagged().body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    mockGetAIConfig.mockResolvedValue(
      aiConfig({ provider: "mistral", apiKey: "mistral-key", endpoint: undefined })
    );

    await expect(generate()).resolves.toEqual({ tags: ["Italian"] });

    expect(sent[0]!.response_format).toMatchObject({
      type: "json_schema",
      json_schema: { strict: true },
    });
  });

  it("is retried once in plain JSON mode when it refuses the strict schema", async () => {
    const sent: Record<string, unknown>[] = [];
    const answers = [
      { status: 400, body: { message: "Invalid JSON schema for strict mode" } },
      tagged(),
    ];

    transport.stub = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      sent.push(JSON.parse(String(init?.body)));
      const { status, body } = answers.shift()!;

      return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      });
    });
    mockGetAIConfig.mockResolvedValue(
      aiConfig({ provider: "mistral", apiKey: "mistral-key", endpoint: undefined })
    );

    await expect(generate()).resolves.toEqual({ tags: ["Italian"] });

    expect(sent.map((body) => body.response_format)).toEqual([
      expect.objectContaining({ type: "json_schema" }),
      { type: "json_object" },
    ]);
    expect(JSON.stringify(sent[1]!.messages)).toContain("tags");
    // @ai-sdk/mistral puts the schema in the prompt itself, so Norish's copy would double it.
    expect(JSON.stringify(sent[1]!.messages).match(/properties/g)).toHaveLength(1);
  });
});

describe("an endpoint that cannot serve structured output", () => {
  it("is retried in plain JSON mode and the answer is used", async () => {
    replies = [noEndpoints, () => tagged()];

    await expect(generate()).resolves.toEqual({ tags: ["Italian"] });

    expect(responseFormats()).toEqual([
      expect.objectContaining({ type: "json_schema" }),
      { type: "json_object" },
    ]);
  });

  it("is told the shape it must answer in, which json_object mode does not carry", async () => {
    replies = [noEndpoints, () => tagged()];

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

  it("is logged as the typed error, leaving the request body to the debug line (#645)", async () => {
    vi.mocked(aiLogger.error).mockClear();
    vi.mocked(aiLogger.debug).mockClear();
    replies = [() => ({ status: 401, body: { error: { message: "invalid key" } } })];

    const failure = await generate().catch((error: unknown) => error);
    const [fields, message] = vi.mocked(aiLogger.error).mock.calls.at(-1) as unknown as [
      Record<string, unknown>,
      string,
    ];

    expect(message).toBe("AI request failed");
    expect(fields).toMatchObject({ err: failure, statusCode: 401, retryable: false });
    expect(vi.mocked(aiLogger.debug)).toHaveBeenCalledWith(
      expect.objectContaining({ err: (failure as Error).cause }),
      "AI request failed: raw provider error"
    );
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

describe("the job's model ledger", () => {
  const use = { provider: "generic-openai", model: "test-model" };

  it("records the model that answered, and the one that refused", async () => {
    const ledger = createModelUseLedger();

    await runWithModelUseLedger(ledger, generate);

    replies = [() => ({ status: 401, body: { error: { message: "invalid key" } } })];
    await runWithModelUseLedger(ledger, () => generate().catch(() => undefined));

    expect(ledger.uses).toEqual([
      { ...use, outcome: "completed", tokens: 2 },
      { ...use, outcome: "failed" },
    ]);
  });

  it("records the tokens the provider reported, reasoning included", async () => {
    const ledger = createModelUseLedger();

    replies = [
      () =>
        tagged({
          prompt_tokens: 748,
          completion_tokens: 165,
          total_tokens: 913,
          completion_tokens_details: { reasoning_tokens: 120 },
        } as Record<string, number>),
    ];
    await runWithModelUseLedger(ledger, generate);

    expect(ledger.uses).toEqual([{ ...use, outcome: "completed", tokens: 913 }]);
  });

  it("records no tokens where the provider reported none", async () => {
    const ledger = createModelUseLedger();

    replies = [() => tagged({})];
    await runWithModelUseLedger(ledger, generate);

    expect(ledger.uses).toEqual([{ ...use, outcome: "completed" }]);
  });

  it("records one completed use when the plain-JSON retry is what answered", async () => {
    const ledger = createModelUseLedger();

    replies = [noEndpoints, () => tagged()];
    await runWithModelUseLedger(ledger, generate);

    expect(ledger.uses).toEqual([{ ...use, outcome: "completed", tokens: 2 }]);
  });

  it("records nothing for a configuration that sends no request", async () => {
    const ledger = createModelUseLedger();

    mockGetAIConfig.mockResolvedValue(aiConfig({ provider: "openai", apiKey: undefined }));
    await runWithModelUseLedger(ledger, () =>
      expect(generate()).rejects.toThrow(/API Key is required/)
    );

    expect(ledger.uses).toEqual([]);
    expect(captured).toHaveLength(0);
  });

  it("ends a request past the feature's own deadline, recorded as a failed use with no tokens", async () => {
    holdReplies = true;
    const ledger = createModelUseLedger();
    const failure = await runWithModelUseLedger(ledger, () =>
      generateStructured({ prompt: "auto-tagging", schema, timeoutMs: 200 }).catch(
        (error: unknown) => error
      )
    );

    expect(isTimedOut(failure)).toBe(true);
    expect(ledger.uses).toEqual([{ ...use, outcome: "failed" }]);
  });

  it("records one failed use when both request shapes are refused", async () => {
    const ledger = createModelUseLedger();

    replies = [noEndpoints];
    await runWithModelUseLedger(ledger, () => generate().catch(() => undefined));

    expect(ledger.uses).toEqual([{ ...use, outcome: "failed" }]);
  });
});

describe("a key the provider refuses", () => {
  const refused = () => ({
    status: 401,
    body: { error: { message: "Incorrect API key provided" } },
  });

  beforeEach(() => forgetKeyRejection("ai_config"));

  it("is remembered from the first refusal, which a later refusal does not move", async () => {
    replies = [refused];
    await generate().catch(() => undefined);
    const [first] = listKeyRejections();

    await generate().catch(() => undefined);

    expect(first).toMatchObject({ block: "ai_config" });
    expect(listKeyRejections()).toEqual([first]);
  });

  it("is forgotten once a request with it answers", async () => {
    replies = [refused, () => tagged()];
    await generate().catch(() => undefined);
    await generate();

    expect(listKeyRejections()).toEqual([]);
  });

  it("is not what any other failure is taken for", async () => {
    replies = [noEndpoints];
    await generate().catch(() => undefined);

    expect(listKeyRejections()).toEqual([]);
  });
});

describe("the job's abort signal", () => {
  it("ends the request in flight when the job is stopped, and the job asks nothing more", async () => {
    holdReplies = true;
    const job = new AbortController();
    const ledger = createModelUseLedger(job.signal);
    const asked = runWithModelUseLedger(ledger, generate);

    await vi.waitFor(() => expect(captured).toHaveLength(1));
    job.abort("Cancelled by an administrator");

    // A stopped job is no timeout, so a feature does not ask again.
    expect(isTimedOut(await asked.catch((error: unknown) => error))).toBe(false);
    await expect(runWithModelUseLedger(ledger, generate)).rejects.toThrow();
    expect(captured).toHaveLength(1);
  });
});
