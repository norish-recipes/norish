// @vitest-environment node
/**
 * What actually reaches each transcription provider.
 *
 * Transcription is tested at the provider-construction level: each provider is
 * pointed at a local HTTP server (or, for the two whose base URL is fixed, a
 * stubbed global fetch) and the assertion is that the request arrives at the
 * correct URL in the correct shape, through the shared transport, with the
 * AI timeout applied.
 */

import { mkdtempSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { IncomingMessage, Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { VideoConfig } from "@norish/config/zod/server-config";

const mockGetVideoConfig = vi.fn();
const mockGetAIConfig = vi.fn();

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getVideoConfig: mockGetVideoConfig,
  getAIConfig: mockGetAIConfig,
}));

vi.mock("@norish/shared-server/logger", () => {
  const logger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() };

  return { aiLogger: logger, videoLogger: logger, createLogger: vi.fn(() => logger) };
});

const { transcribe } = await import("@norish/shared-server/ai/runtime/runtime");
const { AIConfigurationError, AIDisabledError, AIResponseError } =
  await import("@norish/shared-server/ai/runtime/errors");

interface CapturedRequest {
  method: string;
  url: string;
  contentType: string;
  authorization?: string;
  body: Buffer;
}

let server: Server;
let baseUrl: string;
let captured: CapturedRequest[] = [];
/** JSON body the local server answers with; set per test. */
let reply: unknown = { text: "local transcript" };
/** When set, the server records the request but never answers it. */
let holdResponses = false;

let audioPath: string;

beforeAll(async () => {
  const dir = mkdtempSync(join(tmpdir(), "norish-transcription-"));

  audioPath = join(dir, "sample.mp3");
  writeFileSync(audioPath, Buffer.from("not real audio, providers upload bytes verbatim"));

  server = createServer((req: IncomingMessage, res) => {
    const chunks: Buffer[] = [];

    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      captured.push({
        method: req.method ?? "",
        url: req.url ?? "",
        contentType: req.headers["content-type"] ?? "",
        authorization: req.headers.authorization,
        body: Buffer.concat(chunks),
      });

      if (holdResponses) return;

      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(reply));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve()))
  );
});

function videoConfig(overrides: Partial<VideoConfig>): VideoConfig {
  return {
    enabled: true,
    maxLengthSeconds: 600,
    maxVideoFileSize: 100_000_000,
    transcriptionProvider: "openai",
    transcriptionModel: "whisper-1",
    ...overrides,
  } as VideoConfig;
}

beforeEach(() => {
  vi.clearAllMocks();
  captured = [];
  reply = { text: "local transcript" };
  holdResponses = false;
  mockGetAIConfig.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("transcription requests reach the provider correctly", () => {
  it("generic-openai posts multipart form data to <endpoint>/v1/audio/transcriptions", async () => {
    mockGetVideoConfig.mockResolvedValue(
      videoConfig({
        transcriptionProvider: "generic-openai",
        transcriptionEndpoint: baseUrl,
        transcriptionModel: "faster-whisper",
      })
    );

    const transcript = await transcribe(audioPath);

    expect(transcript).toBe("local transcript");
    expect(captured).toHaveLength(1);
    expect(captured[0]!.method).toBe("POST");
    expect(captured[0]!.url).toBe("/v1/audio/transcriptions");
    expect(captured[0]!.contentType).toMatch(/^multipart\/form-data/);

    const body = captured[0]!.body.toString("latin1");

    expect(body).toContain('name="model"');
    expect(body).toContain("faster-whisper");
    expect(body).toContain('name="file"');
    // No key configured means no Authorization header - not a placeholder one.
    expect(captured[0]!.authorization).toBeUndefined();
  });

  it("azure posts multipart form data under the endpoint's /openai path", async () => {
    mockGetVideoConfig.mockResolvedValue(
      videoConfig({
        transcriptionProvider: "azure",
        transcriptionEndpoint: baseUrl,
        transcriptionApiKey: "azure-key",
        transcriptionModel: "whisper-deployment",
      })
    );

    const transcript = await transcribe(audioPath);

    expect(transcript).toBe("local transcript");
    expect(captured).toHaveLength(1);
    expect(captured[0]!.method).toBe("POST");
    // The /openai path suffix is appended to the configured endpoint; the
    // deployment travels in the form body, not the path.
    expect(captured[0]!.url).toBe("/openai/audio/transcriptions");
    expect(captured[0]!.contentType).toMatch(/^multipart\/form-data/);
    expect(captured[0]!.body.toString("latin1")).toContain("whisper-deployment");
  });

  it("ollama posts JSON with base64 input_audio to <endpoint>/api/generate", async () => {
    reply = { model: "whisper-audio", response: "ollama transcript", done: true };
    mockGetVideoConfig.mockResolvedValue(
      videoConfig({
        transcriptionProvider: "ollama",
        transcriptionEndpoint: `${baseUrl}/`,
        transcriptionModel: "whisper-audio",
      })
    );

    const transcript = await transcribe(audioPath);

    expect(transcript).toBe("ollama transcript");
    expect(captured).toHaveLength(1);
    expect(captured[0]!.method).toBe("POST");
    // The trailing slash on the configured endpoint is stripped, not doubled.
    expect(captured[0]!.url).toBe("/api/generate");
    expect(captured[0]!.contentType).toMatch(/^application\/json/);

    const body = JSON.parse(captured[0]!.body.toString()) as Record<string, unknown>;

    expect(body.model).toBe("whisper-audio");
    expect(body.stream).toBe(false);
    expect(Array.isArray(body.input_audio)).toBe(true);

    const [audio] = body.input_audio as { format: string; data: string }[];

    expect(audio!.format).toBe("mp3");
    expect(Buffer.from(audio!.data, "base64").toString()).toContain("not real audio");
  });

  it("openai posts multipart form data to api.openai.com with the bearer key", async () => {
    const sent: { url: string; init?: RequestInit }[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        sent.push({ url: String(url), init });

        return new Response(JSON.stringify({ text: "openai transcript" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      })
    );
    mockGetVideoConfig.mockResolvedValue(
      videoConfig({ transcriptionProvider: "openai", transcriptionApiKey: "openai-key" })
    );

    const transcript = await transcribe(audioPath);

    expect(transcript).toBe("openai transcript");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toBe("https://api.openai.com/v1/audio/transcriptions");

    const headers = new Headers(sent[0]!.init?.headers);

    expect(headers.get("authorization")).toBe("Bearer openai-key");
    expect(sent[0]!.init?.body).toBeInstanceOf(FormData);

    const form = sent[0]!.init?.body as FormData;

    expect(form.get("model")).toBe("whisper-1");
    expect(form.get("file")).toBeInstanceOf(Blob);
  });

  it("groq posts multipart form data to api.groq.com with the bearer key", async () => {
    const sent: { url: string; init?: RequestInit }[] = [];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        sent.push({ url: String(url), init });

        return new Response(JSON.stringify({ text: "groq transcript", x_groq: { id: "req_1" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      })
    );
    mockGetVideoConfig.mockResolvedValue(
      videoConfig({
        transcriptionProvider: "groq",
        transcriptionApiKey: "groq-key",
        transcriptionModel: "whisper-large-v3",
      })
    );

    const transcript = await transcribe(audioPath);

    expect(transcript).toBe("groq transcript");
    expect(sent).toHaveLength(1);
    expect(sent[0]!.url).toContain("api.groq.com");
    expect(sent[0]!.url).toContain("/audio/transcriptions");

    const headers = new Headers(sent[0]!.init?.headers);

    expect(headers.get("authorization")).toBe("Bearer groq-key");

    const form = sent[0]!.init?.body as FormData;

    expect(form.get("model")).toBe("whisper-large-v3");
  });

  it("falls back to the AI configuration's endpoint and key when transcription has none", async () => {
    mockGetVideoConfig.mockResolvedValue(
      videoConfig({
        transcriptionProvider: "generic-openai",
        transcriptionEndpoint: undefined,
        transcriptionApiKey: undefined,
      })
    );
    mockGetAIConfig.mockResolvedValue({ endpoint: baseUrl, apiKey: "ai-config-key" });

    const transcript = await transcribe(audioPath);

    expect(transcript).toBe("local transcript");
    expect(captured).toHaveLength(1);
    expect(captured[0]!.url).toBe("/v1/audio/transcriptions");
    expect(captured[0]!.authorization).toBe("Bearer ai-config-key");
  });

  it("reports an empty transcript instead of storing one", async () => {
    reply = { text: "   " };
    mockGetVideoConfig.mockResolvedValue(
      videoConfig({
        transcriptionProvider: "generic-openai",
        transcriptionEndpoint: baseUrl,
      })
    );

    await expect(transcribe(audioPath)).rejects.toBeInstanceOf(AIResponseError);
  });

  it("refuses without a provider call when video parsing is disabled", async () => {
    mockGetVideoConfig.mockResolvedValue(videoConfig({ enabled: false }));

    await expect(transcribe(audioPath)).rejects.toBeInstanceOf(AIDisabledError);
    expect(captured).toHaveLength(0);
  });

  it("refuses a cloud provider without an API key, as a non-retryable configuration error", async () => {
    mockGetVideoConfig.mockResolvedValue(
      videoConfig({ transcriptionProvider: "openai", transcriptionApiKey: undefined })
    );

    const error = await transcribe(audioPath).catch((err: unknown) => err);

    expect(error).toBeInstanceOf(AIConfigurationError);
    expect((error as InstanceType<typeof AIConfigurationError>).retryable).toBe(false);
    expect(captured).toHaveLength(0);
  });

  it("gives up on a hung endpoint within the configured AI timeout", async () => {
    // A server that accepts the connection and never answers. Before the
    // shared transport, four of the five providers would wait forever here.
    holdResponses = true;
    mockGetVideoConfig.mockResolvedValue(
      videoConfig({
        transcriptionProvider: "generic-openai",
        transcriptionEndpoint: baseUrl,
      })
    );
    mockGetAIConfig.mockResolvedValue({ timeoutMs: 300 });

    const started = Date.now();
    const error = await transcribe(audioPath).catch((err: unknown) => err);

    expect(Date.now() - started).toBeLessThan(5_000);
    expect(error).toBeInstanceOf(Error);
    expect((error as { retryable?: boolean }).retryable).toBe(true);
  });
});
