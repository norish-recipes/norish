/**
 * Deterministic external-model adapter for production-like browser tests.
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
 * controlled response is a real HTTP round-trip, not an in-process stub. It
 * also serves the OpenAI-compatible image route (`POST
 * {baseURL}/images/generations`, answering `data[0].b64_json`), which the
 * Image Generation block reaches through the same `generic-openai` provider,
 * and TypeSafe's evaluation route (`POST {baseURL}/systemone`, answering
 * `answers[id].{type, choice|score|noul, probabilities, confidence}`), which
 * the Decision block reaches through its `endpoint` (ADR-0035).
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

/** One answer in TypeSafe's wire shape; a Boolean question answers as `noul`. */
export type TypeSafeAnswer =
  | { type: "choice"; choice: string; probabilities: Record<string, number>; confidence?: number }
  | { type: "score"; score: number; probabilities: Record<string, number>; confidence?: number }
  | { type: "noul"; noul: number };

/**
 * A deterministic Decision: `answers` is returned keyed by the asked question
 * ids. Only the ids a request asked are answered — the SDK refuses an answer
 * to a question it did not ask — so one persistent default can carry the
 * answers to every question a scenario's flow asks, at whatever point each
 * is asked (triage on the page, the kind on the recipe, validation after).
 */
export interface DecisionDirective {
  kind: "decision";
  answers: Record<string, TypeSafeAnswer>;
  /** The model id the response reports; the release behind `jev-latest`. */
  model?: string;
}

export type Directive = SuccessDirective | ErrorDirective | DecisionDirective;

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
  /** Image route: response when its one-shot queue is empty (null = fail loudly). */
  setImageDefault(directive: Directive | null): void;
  /** Image route: queue one-shot responses, consumed FIFO before its default. */
  enqueueImage(...directives: Directive[]): void;
  /** Image route: persistent success returning `imageBase64` as `data[0].b64_json`. */
  succeedImageWith(imageBase64: string): void;
  /** Image route: persistent permanent failure (HTTP 400, non-retryable). */
  failImagePermanently(message?: string): void;
  /** Image route: persistent retryable failure (HTTP 503). */
  failImageRetryably(message?: string): void;
  /** Decision route: response when its one-shot queue is empty (null = fail loudly). */
  setDecisionDefault(directive: DecisionDirective | ErrorDirective | null): void;
  /** Decision route: queue one-shot responses, consumed FIFO before its default. */
  enqueueDecision(...directives: (DecisionDirective | ErrorDirective)[]): void;
  /** Decision route: persistent success answering `answers` for every request. */
  decideWith(answers: Record<string, TypeSafeAnswer>, model?: string): void;
  /** Decision route: persistent permanent failure (HTTP 401, a rejected key). */
  failDecisionPermanently(message?: string): void;
  /** Decision route: persistent retryable failure (HTTP 503). */
  failDecisionRetryably(message?: string): void;
  /** Clear every queue, every default, and captured requests. */
  reset(): void;
  /**
   * Hold responses: requests are still recorded (so `requestCount` advances and
   * a queued worker's job appears "active"), but the HTTP response is withheld
   * until {@link release} is called. Lets a scenario observe a pending state.
   */
  hold(): void;
  /** Release any held responses and stop holding. */
  release(): void;
  /** Number of requests received on either route since the last reset. */
  readonly requestCount: number;
  /** Number of image-generation requests received since the last reset. */
  readonly imageRequestCount: number;
  /** Number of Decision requests received since the last reset. */
  readonly decisionRequestCount: number;
  /** Captured requests on either route, in arrival order. */
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

/** Build an OpenAI-compatible image response carrying `imageBase64` verbatim. */
export function buildImageGenerationBody(imageBase64: string): unknown {
  return { created: 0, data: [{ b64_json: imageBase64 }] };
}

/** Build a TypeSafe evaluation response carrying `answers` verbatim. */
export function buildDecisionBody(
  answers: Record<string, TypeSafeAnswer>,
  model = "jev-e2e-harness"
): unknown {
  return { model, answers, usage: { input_tokens: 1, output_tokens: 0 } };
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
  private imageQueue: Directive[] = [];
  private imageDefaultDirective: Directive | null = null;
  private decisionQueue: Directive[] = [];
  private decisionDefaultDirective: Directive | null = null;
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

  setImageDefault(directive: Directive | null): void {
    this.imageDefaultDirective = directive;
  }

  enqueueImage(...directives: Directive[]): void {
    this.imageQueue.push(...directives);
  }

  succeedImageWith(imageBase64: string): void {
    this.setImageDefault({ kind: "success", content: imageBase64 });
  }

  failImagePermanently(message = "image refused"): void {
    this.setImageDefault({
      kind: "error",
      status: 400,
      body: errorBody(message, "invalid_request_error"),
    });
  }

  failImageRetryably(message = "image provider overloaded"): void {
    this.setImageDefault({ kind: "error", status: 503, body: errorBody(message, "server_error") });
  }

  setDecisionDefault(directive: DecisionDirective | ErrorDirective | null): void {
    this.decisionDefaultDirective = directive;
  }

  enqueueDecision(...directives: (DecisionDirective | ErrorDirective)[]): void {
    this.decisionQueue.push(...directives);
  }

  decideWith(answers: Record<string, TypeSafeAnswer>, model?: string): void {
    this.setDecisionDefault({ kind: "decision", answers, model });
  }

  failDecisionPermanently(message = "invalid api key"): void {
    this.setDecisionDefault({ kind: "error", status: 401, body: { message } });
  }

  failDecisionRetryably(message = "decision model overloaded"): void {
    this.setDecisionDefault({ kind: "error", status: 503, body: { message } });
  }

  reset(): void {
    this.queue = [];
    this.defaultDirective = null;
    this.imageQueue = [];
    this.imageDefaultDirective = null;
    this.decisionQueue = [];
    this.decisionDefaultDirective = null;
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

  get imageRequestCount(): number {
    return this.captured.filter((request) => request.path.endsWith("/images/generations")).length;
  }

  get decisionRequestCount(): number {
    return this.captured.filter((request) => request.path.endsWith("/systemone")).length;
  }

  get requests(): readonly CapturedRequest[] {
    return this.captured;
  }

  /** Record a request and resolve the response for it from its route's lane. */
  resolve(request: CapturedRequest, lane: Lane = "chat"): Directive {
    this.captured.push(request);

    const [queue, fallback] =
      lane === "image"
        ? [this.imageQueue, this.imageDefaultDirective]
        : lane === "decision"
          ? [this.decisionQueue, this.decisionDefaultDirective]
          : [this.queue, this.defaultDirective];

    return (
      queue.shift() ??
      fallback ?? {
        kind: "error",
        status: 500,
        body: errorBody("no AI directive configured for the harness", "server_error"),
      }
    );
  }
}

type Lane = "chat" | "image" | "decision";

/**
 * The directive's answers for the question ids the request asked. A body
 * without a readable `questions` map gets every answer, so a malformed
 * request still fails on the SDK's side rather than being masked here.
 */
function answersAsked(
  body: unknown,
  answers: Record<string, TypeSafeAnswer>
): Record<string, TypeSafeAnswer> {
  const questions =
    body && typeof body === "object" && "questions" in body
      ? (body as { questions?: unknown }).questions
      : null;

  if (!questions || typeof questions !== "object") return answers;

  return Object.fromEntries(Object.entries(answers).filter(([id]) => id in questions));
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
  const lane: Lane | null = path.endsWith("/chat/completions")
    ? "chat"
    : path.endsWith("/images/generations")
      ? "image"
      : path.endsWith("/systemone")
        ? "decision"
        : null;

  if (req.method !== "POST" || !lane) {
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

  const directive = controller.resolve({ path, body: parsed }, lane);

  // The request is recorded above; withhold the response while holding so a
  // scenario can observe the queued worker's job as active/pending.
  await controller.waitForGate();

  if (directive.kind === "decision") {
    sendJson(res, 200, buildDecisionBody(answersAsked(parsed, directive.answers), directive.model));

    return;
  }

  if (directive.kind === "success") {
    sendJson(
      res,
      200,
      lane === "image"
        ? buildImageGenerationBody(directive.content)
        : buildChatCompletionBody(directive.content, extractModel(parsed))
    );

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
      controller.release();
      await new Promise<void>((resolve) => {
        active.close(() => resolve());
        active.closeAllConnections();
      });
    },
  };
}
