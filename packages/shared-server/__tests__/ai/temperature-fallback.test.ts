// @vitest-environment node
/**
 * A model that rejects `temperature` must still answer.
 *
 * Reported as a self-hosted import failure: Anthropic returns 400 "temperature
 * is deprecated for this model" for claude-sonnet-5, so every extraction died
 * before the prompt was ever read (#514). The provider package now knows that
 * model and drops the parameter itself; the shape below is what any model it
 * has not heard of - including whatever sits behind a generic endpoint - still
 * does.
 */

import type { LanguageModelV3, LanguageModelV3CallOptions } from "@ai-sdk/provider";
import { APICallError } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetTemperatureFallbackCache,
  withTemperatureFallback,
} from "@norish/shared-server/ai/providers/temperature-fallback";

/** The 400 Anthropic returns for claude-sonnet-5 when temperature is present. */
function temperatureRejection(): APICallError {
  return new APICallError({
    message: "temperature is deprecated for this model.",
    statusCode: 400,
    url: "https://api.anthropic.com/v1/messages",
    requestBodyValues: {},
    responseBody: JSON.stringify({
      type: "error",
      error: {
        type: "invalid_request_error",
        message: "temperature is deprecated for this model.",
      },
    }),
  });
}

const ANSWER = { content: [{ type: "text", text: "ok" }] } as never;

/**
 * A model that fails while `temperature` is present and answers once it is gone.
 * Records the temperature of every call so the retry can be inspected.
 */
function createModel(options: { rejectsTemperature: boolean }) {
  const temperatures: (number | undefined)[] = [];

  const doGenerate = vi.fn(async (params: LanguageModelV3CallOptions) => {
    temperatures.push(params.temperature);

    if (options.rejectsTemperature && params.temperature != null) throw temperatureRejection();

    return ANSWER;
  });

  const model = {
    specificationVersion: "v3",
    provider: "anthropic",
    modelId: "claude-sonnet-5",
    supportedUrls: {},
    doGenerate,
    doStream: vi.fn(),
  } as unknown as LanguageModelV3;

  return { model, doGenerate, temperatures };
}

function call(model: LanguageModelV3, temperature?: number) {
  return model.doGenerate({
    prompt: [{ role: "user", content: [{ type: "text", text: "hi" }] }],
    temperature,
  } as LanguageModelV3CallOptions);
}

describe("withTemperatureFallback", () => {
  beforeEach(() => {
    resetTemperatureFallbackCache();
  });

  it("retries without temperature when the model rejects it", async () => {
    const { model, temperatures } = createModel({ rejectsTemperature: true });

    const wrapped = withTemperatureFallback(model) as LanguageModelV3;

    await expect(call(wrapped, 0.2)).resolves.toBe(ANSWER);
    expect(temperatures).toEqual([0.2, undefined]);
  });

  it("stops sending temperature to a model that already rejected it", async () => {
    const { model, temperatures } = createModel({ rejectsTemperature: true });

    const wrapped = withTemperatureFallback(model) as LanguageModelV3;

    await call(wrapped, 0.2);
    await call(wrapped, 0.2);

    // First call pays for the rejection; the second skips straight to the retry.
    expect(temperatures).toEqual([0.2, undefined, undefined]);
  });

  it("leaves a model that accepts temperature alone", async () => {
    const { model, doGenerate, temperatures } = createModel({ rejectsTemperature: false });

    const wrapped = withTemperatureFallback(model) as LanguageModelV3;

    await call(wrapped, 0.2);

    expect(doGenerate).toHaveBeenCalledOnce();
    expect(temperatures).toEqual([0.2]);
  });

  it("propagates errors that are not about temperature", async () => {
    const { model } = createModel({ rejectsTemperature: false });

    (model.doGenerate as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new APICallError({
        message: "max_tokens is too large",
        statusCode: 400,
        url: "https://api.anthropic.com/v1/messages",
        requestBodyValues: {},
      })
    );

    const wrapped = withTemperatureFallback(model) as LanguageModelV3;

    await expect(call(wrapped, 0.2)).rejects.toThrow("max_tokens is too large");
  });

  it("does not retry transient failures into a different request", async () => {
    const { model, doGenerate } = createModel({ rejectsTemperature: false });

    (doGenerate as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new APICallError({
        message: "temperature service overloaded",
        statusCode: 529,
        url: "https://api.anthropic.com/v1/messages",
        requestBodyValues: {},
      })
    );

    const wrapped = withTemperatureFallback(model) as LanguageModelV3;

    await expect(call(wrapped, 0.2)).rejects.toThrow("overloaded");
    expect(doGenerate).toHaveBeenCalledOnce();
  });

  it("never learns from a 400 that only mentioned temperature in passing", async () => {
    const { model, doGenerate } = createModel({ rejectsTemperature: false });

    const unrelated = new APICallError({
      message: "temperature is fine; prompt is too long",
      statusCode: 400,
      url: "https://api.anthropic.com/v1/messages",
      requestBodyValues: {},
    });

    (doGenerate as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(unrelated)
      .mockRejectedValueOnce(unrelated);

    const wrapped = withTemperatureFallback(model) as LanguageModelV3;

    await expect(call(wrapped, 0.2)).rejects.toThrow("prompt is too long");

    // The retry failed too, so the model is not remembered and the next call
    // still gets its configured temperature.
    const temperatures: (number | undefined)[] = [];

    (doGenerate as ReturnType<typeof vi.fn>).mockImplementation(
      async (params: LanguageModelV3CallOptions) => {
        temperatures.push(params.temperature);

        return ANSWER;
      }
    );

    await call(wrapped, 0.2);
    expect(temperatures).toEqual([0.2]);
  });
});
