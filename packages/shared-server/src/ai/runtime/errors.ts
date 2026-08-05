/**
 * AI Runtime failures.
 *
 * Every failure the runtime throws is one of these, and each carries whether a
 * retry could succeed — so a queue worker can stop burning attempts with
 * backoff on states that cannot change between attempts, AI having been
 * switched off being the motivating case.
 *
 * Provider failures are classified from the SDK's structured error type, never
 * by searching error messages: a provider rewording a message must not change
 * how Norish reacts to it.
 */

import { APICallError, NoObjectGeneratedError } from "ai";

export abstract class AIError extends Error {
  /** Whether the same request could succeed on a retry, without operator action. */
  abstract readonly retryable: boolean;
}

/** AI (or the feature the request needs) is switched off. */
export class AIDisabledError extends AIError {
  readonly retryable = false;

  constructor(message = "AI features are disabled. Enable them in the admin settings.") {
    super(message);
    this.name = "AIDisabledError";
  }
}

/** The configuration cannot serve the request: a missing key or endpoint. */
export class AIConfigurationError extends AIError {
  readonly retryable = false;

  constructor(message: string) {
    super(message);
    this.name = "AIConfigurationError";
  }
}

/** The provider (or the network in front of it) failed to answer. */
export class AIProviderError extends AIError {
  readonly retryable: boolean;

  constructor(message: string, options: { retryable: boolean; cause?: unknown }) {
    super(message, { cause: options.cause });
    this.name = "AIProviderError";
    this.retryable = options.retryable;
  }
}

/** The provider answered, but the response is unusable: schema mismatch or empty. */
export class AIResponseError extends AIError {
  // A model that answered wrong once may answer right the next time.
  readonly retryable = true;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "AIResponseError";
  }
}

function describeAPICallError(error: APICallError): string {
  const status = error.statusCode;

  if (status === 401 || status === 403) {
    return "The AI provider rejected the configured API key. Check the AI configuration.";
  }

  if (status === 429) {
    return "The AI provider rate-limited the request.";
  }

  if (status != null && status >= 500) {
    return "The AI provider failed to answer.";
  }

  return error.message;
}

/** A timeout from `AbortSignal.timeout` or the shared transport. */
function isTimeout(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "TimeoutError" ||
      error.name === "AbortError" ||
      error.name === "HeadersTimeoutError" ||
      error.name === "BodyTimeoutError")
  );
}

/**
 * Turn whatever a model call threw into a typed AI error, carrying the
 * original as `cause`.
 */
export function toAIError(error: unknown): AIError {
  if (error instanceof AIError) return error;

  if (NoObjectGeneratedError.isInstance(error)) {
    return new AIResponseError("The model's response did not match the expected shape.", {
      cause: error,
    });
  }

  if (APICallError.isInstance(error)) {
    return new AIProviderError(describeAPICallError(error), {
      // The SDK derives this from the response itself (408/409/429/5xx).
      retryable: error.isRetryable,
      cause: error,
    });
  }

  if (isTimeout(error)) {
    return new AIProviderError("The AI request timed out. The service may be overloaded.", {
      retryable: true,
      cause: error,
    });
  }

  // An unclassified failure — a socket error, a DNS failure — is worth a
  // retry: refusing to retry is reserved for states known not to change.
  return new AIProviderError(error instanceof Error ? error.message : "The AI request failed.", {
    retryable: true,
    cause: error,
  });
}
