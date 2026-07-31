/**
 * Fake AI provider for the production-like AI E2E harness.
 *
 * This is the ONLY boundary the harness replaces. The production server is
 * configured (through its normal env-seeded AI config) to use the real
 * `generic-openai` provider pointed at this server, so every other layer —
 * the AI SDK client, the registered queue AI-handler, the queue worker,
 * repositories, tRPC, realtime, and the browser — stays genuinely in the path.
 * Only the third-party HTTP call to an external model is intercepted here.
 *
 * The server speaks the OpenAI Chat Completions wire format that
 * `@ai-sdk/openai-compatible` expects (`POST {baseURL}/chat/completions`,
 * reading `choices[0].message.content` as the structured-output JSON), so a
 * controlled response is a real HTTP round-trip, not an in-process stub.
 *
 * Responses are selected at runtime through {@link AIProviderControl}: a
 * persistent default plus an optional FIFO queue of one-shot responses. Tests
 * run the provider in-process and drive the control directly, while the server
 * under test reaches it over the loopback interface.
 */
import { createServer } from "node:http";
import type { IncomingMessage, Server, ServerResponse } from "node:http";

/** A deterministic success: `content` is returned as the assistant message. */
export interface SuccessDirective {
  kind: "success";
  /** Raw string placed in `choices[0].message.content` (usually JSON). */
  content: string;
}

/** A deterministic HTTP failure from the provider. */
export interface ErrorDirective {
  kind: "error";
  /** HTTP status. 4xx (except 408/409/429) is non-retryable; 5xx/429 retry. */
  status: number;
  /** Optional response body; a small OpenAI-style error is used by default. */
  body?: unknown;
}

export type Directive = SuccessDirective | ErrorDirective;

/** A chat-completion request captured for assertions. */
export interface CapturedRequest {
  path: string;
  body: unknown;
}

export interface OpenAIChatCompletion {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: "assistant"; content: string };
    finish_reason: string;
  }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface AIProviderControl {
  /** Response returned when the one-shot queue is empty (null = fail loudly). */
  setDefault(directive: Directive | null): void;
  /** Queue one or more one-shot responses, consumed FIFO before the default. */
  enqueue(...directives: Directive[]): void;
  /** Persistent success returning `json` as the structured object. */
  succeedWith(json: unknown): void;
  /** Persistent permanent failure (HTTP 400, non-retryable). */
  failPermanently(message?: string): void;
  /** Persistent retryable failure (HTTP 503). */
  failRetryably(message?: string): void;
  /** Persistent HTTP 200 whose body cannot satisfy a structured-output schema. */
  respondInvalid(raw?: string): void;
  /** Clear the queue, the default, and captured requests. */
  reset(): void;
  /**
   * Hold responses: requests are still recorded (so `requestCount` advances and
   * a queued worker's job appears "active"), but the HTTP response is withheld
   * until {@link release} is called. Lets a scenario observe a pending state.
   */
  hold(): void;
  /** Release any held responses and stop holding. */
  release(): void;
  /** Number of chat-completion requests received since the last reset. */
  readonly requestCount: number;
  /** Captured chat-completion requests, in arrival order. */
  readonly requests: readonly CapturedRequest[];
}

export interface FakeAIProvider {
  /** Base endpoint to hand to `AI_ENDPOINT` (no `/v1` suffix). */
  readonly url: string;
  readonly port: number;
  readonly control: AIProviderControl;
  start(): Promise<void>;
  stop(): Promise<void>;
}

function errorBody(message: string, type: string): unknown {
  return { error: { message, type, code: null } };
}

/** Build an OpenAI Chat Completions body carrying `content` verbatim. */
export function buildChatCompletionBody(
  content: string,
  model = "test-model"
): OpenAIChatCompletion {
  return {
    id: "chatcmpl-e2e-harness",
    object: "chat.completion",
    created: 0,
    model,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  };
}

class Controller implements AIProviderControl {
  private queue: Directive[] = [];
  private defaultDirective: Directive | null = null;
  private captured: CapturedRequest[] = [];
  private gate: Promise<void> | null = null;
  private openGate: (() => void) | null = null;

  setDefault(directive: Directive | null): void {
    this.defaultDirective = directive;
  }

  enqueue(...directives: Directive[]): void {
    this.queue.push(...directives);
  }

  succeedWith(json: unknown): void {
    this.setDefault({ kind: "success", content: JSON.stringify(json) });
  }

  failPermanently(message = "permanent failure"): void {
    this.setDefault({
      kind: "error",
      status: 400,
      body: errorBody(message, "invalid_request_error"),
    });
  }

  failRetryably(message = "retryable failure"): void {
    this.setDefault({ kind: "error", status: 503, body: errorBody(message, "server_error") });
  }

  respondInvalid(raw = "not valid structured output"): void {
    this.setDefault({ kind: "success", content: raw });
  }

  reset(): void {
    this.queue = [];
    this.defaultDirective = null;
    this.captured = [];
    this.release();
  }

  hold(): void {
    if (this.gate) return;

    this.gate = new Promise<void>((resolve) => {
      this.openGate = resolve;
    });
  }

  release(): void {
    this.openGate?.();
    this.gate = null;
    this.openGate = null;
  }

  /** Resolves immediately unless currently holding. */
  waitForGate(): Promise<void> {
    return this.gate ?? Promise.resolve();
  }

  get requestCount(): number {
    return this.captured.length;
  }

  get requests(): readonly CapturedRequest[] {
    return this.captured;
  }

  /** Record a request and resolve the response for it. */
  resolve(request: CapturedRequest): Directive {
    this.captured.push(request);

    return (
      this.queue.shift() ??
      this.defaultDirective ?? {
        kind: "error",
        status: 500,
        body: errorBody("no AI directive configured for the harness", "server_error"),
      }
    );
  }
}

function extractModel(body: unknown): string {
  if (body && typeof body === "object" && "model" in body) {
    const model = (body as { model?: unknown }).model;

    if (typeof model === "string" && model.length > 0) {
      return model;
    }
  }

  return "test-model";
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk: Buffer) => {
      raw += chunk.toString("utf8");
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function handleRequest(
  controller: Controller,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const path = req.url ?? "";

  if (req.method !== "POST" || !path.endsWith("/chat/completions")) {
    sendJson(res, 404, errorBody("unsupported endpoint", "invalid_request_error"));

    return;
  }

  const raw = await readBody(req);
  let parsed: unknown = null;

  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = raw;
  }

  const directive = controller.resolve({ path, body: parsed });

  // The request is recorded above; withhold the response while holding so a
  // scenario can observe the queued worker's job as active/pending.
  await controller.waitForGate();

  if (directive.kind === "success") {
    sendJson(res, 200, buildChatCompletionBody(directive.content, extractModel(parsed)));

    return;
  }

  sendJson(res, directive.status, directive.body ?? errorBody("provider error", "server_error"));
}

export function createFakeAIProvider(options: { port?: number } = {}): FakeAIProvider {
  const controller = new Controller();
  const host = "127.0.0.1";
  let server: Server | null = null;
  let port = options.port ?? 0;

  return {
    get url() {
      return `http://${host}:${port}`;
    },
    get port() {
      return port;
    },
    control: controller,
    async start() {
      const created = createServer((req, res) => {
        void handleRequest(controller, req, res).catch(() => {
          sendJson(res, 500, errorBody("harness provider crashed", "server_error"));
        });
      });

      await new Promise<void>((resolve, reject) => {
        created.once("error", reject);
        created.listen(port, host, () => {
          const address = created.address();

          if (address && typeof address === "object") {
            port = address.port;
          }

          resolve();
        });
      });

      server = created;
    },
    async stop() {
      const active = server;

      if (!active) return;

      server = null;
      await new Promise<void>((resolve) => active.close(() => resolve()));
    },
  };
}
