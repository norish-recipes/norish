// @vitest-environment node
/**
 * AI Runtime failure classification.
 *
 * Provider failures are classified from the SDK's structured error type —
 * status codes and the SDK's own retryability — never by searching error
 * messages, so a provider rewording a message cannot change how Norish
 * reacts to it. Each typed error carries whether a retry could succeed.
 */

import { APICallError, NoObjectGeneratedError } from "ai";
import { describe, expect, it } from "vitest";

import {
  AIConfigurationError,
  AIDisabledError,
  AIProviderError,
  AIResponseError,
  toAIError,
} from "@norish/shared-server/ai/runtime/errors";

function apiCallError(statusCode: number, message = "provider said no"): APICallError {
  return new APICallError({
    message,
    url: "https://provider.example/v1/chat/completions",
    requestBodyValues: {},
    statusCode,
    responseBody: "{}",
    isRetryable:
      statusCode === 408 || statusCode === 409 || statusCode === 429 || statusCode >= 500,
  });
}

describe("toAIError", () => {
  it("passes an AIError through unchanged", () => {
    const original = new AIDisabledError();

    expect(toAIError(original)).toBe(original);
  });

  it("marks a schema-mismatch response as retryable and keeps the SDK error as cause", () => {
    const sdkError = new NoObjectGeneratedError({
      message: "No object generated",
      text: "not json",
      response: undefined,
      usage: undefined,
      finishReason: undefined,
    });

    const error = toAIError(sdkError);

    expect(error).toBeInstanceOf(AIResponseError);
    expect(error.retryable).toBe(true);
    expect(error.cause).toBe(sdkError);
  });

  it("marks an authentication failure as not retryable, from the status code", () => {
    const error = toAIError(apiCallError(401));

    expect(error).toBeInstanceOf(AIProviderError);
    expect(error.retryable).toBe(false);
    expect(error.message).toContain("API key");
  });

  it("marks a rate limit as retryable, from the status code", () => {
    const error = toAIError(apiCallError(429));

    expect(error.retryable).toBe(true);
    expect(error.message).toContain("rate-limited");
  });

  it("marks a provider 5xx as retryable", () => {
    const error = toAIError(apiCallError(503));

    expect(error.retryable).toBe(true);
  });

  it("keeps the provider's own message for a plain 400, without inspecting it", () => {
    const error = toAIError(apiCallError(400, "temperature is not supported"));

    expect(error).toBeInstanceOf(AIProviderError);
    expect(error.retryable).toBe(false);
    expect(error.message).toBe("temperature is not supported");
  });

  it("marks a timeout as retryable", () => {
    const timeout = new DOMException("The operation timed out.", "TimeoutError");

    const error = toAIError(timeout);

    expect(error).toBeInstanceOf(AIProviderError);
    expect(error.retryable).toBe(true);
    expect(error.message).toContain("timed out");
  });

  it("treats an unclassified failure as retryable", () => {
    const error = toAIError(new Error("socket hang up"));

    expect(error).toBeInstanceOf(AIProviderError);
    expect(error.retryable).toBe(true);
    expect(error.message).toBe("socket hang up");
  });
});

describe("the hierarchy's retryability", () => {
  it("never retries AI having been switched off or misconfigured", () => {
    expect(new AIDisabledError().retryable).toBe(false);
    expect(new AIConfigurationError("no key").retryable).toBe(false);
  });

  it("always retries an unusable response", () => {
    expect(new AIResponseError("empty").retryable).toBe(true);
  });
});
