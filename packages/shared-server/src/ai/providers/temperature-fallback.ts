/**
 * Temperature fallback - keeps AI features working on models that reject it.
 *
 * A growing set of models (Anthropic's claude-sonnet-5, OpenAI's reasoning
 * models) answer any request carrying `temperature` with a 400 instead of
 * ignoring the parameter. That turns a harmless preference into a hard failure:
 * an import or enrichment run dies before the model ever sees the prompt.
 *
 * The AI SDK's own providers already drop the parameter for the models they
 * know, and keeping them current is the first line of defence (#514 was an
 * out-of-date `@ai-sdk/anthropic` that had never heard of claude-sonnet-5).
 * That list is a hardcoded table of model ids, though: it lags every new
 * release by however long an upgrade takes, and `@ai-sdk/openai-compatible` -
 * the path behind Ollama, LM Studio and every generic endpoint - has no such
 * table at all, because the model on the far side is whatever the operator
 * runs. Norish is installed by people who choose their own model, so it cannot
 * assume the provider package knows it.
 *
 * The configured temperature is a preference, not a requirement, so a model that
 * refuses it gets the same request again without it. Models that answer the
 * retry are remembered for the life of the process, so only the first call per
 * model pays for the rejected round trip.
 *
 * Only `doGenerate` is wrapped - Norish calls `generateText` everywhere and
 * never streams, so there is no streaming path to recover.
 */

import type { LanguageModel, LanguageModelMiddleware } from "ai";
import { APICallError, wrapLanguageModel } from "ai";

import { aiLogger } from "@norish/shared-server/logger";

/**
 * Models known to reject `temperature`, keyed by `provider:modelId`.
 *
 * Process-local on purpose: which parameters a model accepts is a property of
 * the upstream service, not of this install, and it changes when the provider
 * changes it. A restart re-learns it in one request.
 */
const modelsRejectingTemperature = new Set<string>();

function modelKey(model: { provider: string; modelId: string }): string {
  return `${model.provider}:${model.modelId}`;
}

/**
 * Whether an error is the provider complaining about `temperature` itself.
 *
 * Scoped to request-shape rejections: a 5xx, a timeout, or a rate limit is
 * transient and must keep its own error, not be retried into a silently
 * different request.
 */
function isTemperatureRejection(error: unknown): boolean {
  if (!APICallError.isInstance(error)) return false;
  if (error.statusCode !== 400 && error.statusCode !== 422) return false;

  const responseBody = typeof error.responseBody === "string" ? error.responseBody : "";

  return /temperature/i.test(`${error.message} ${responseBody}`);
}

const temperatureFallbackMiddleware: LanguageModelMiddleware = {
  specificationVersion: "v3",

  async wrapGenerate({ doGenerate, params, model }) {
    // Nothing to fall back from, so stay out of the way entirely.
    if (params.temperature == null) return doGenerate();

    const key = modelKey(model);

    if (modelsRejectingTemperature.has(key)) {
      return model.doGenerate({ ...params, temperature: undefined });
    }

    try {
      return await doGenerate();
    } catch (error) {
      if (!isTemperatureRejection(error)) throw error;

      aiLogger.warn(
        { provider: model.provider, model: model.modelId, temperature: params.temperature },
        "Model rejected the configured temperature; retrying without it"
      );

      const result = await model.doGenerate({ ...params, temperature: undefined });

      // Only remember the model once dropping temperature actually helped - a
      // 400 that merely mentioned the word stays a one-off.
      modelsRejectingTemperature.add(key);

      return result;
    }
  },
};

/**
 * Wrap a model so a rejected `temperature` is retried without it.
 */
export function withTemperatureFallback(model: LanguageModel): LanguageModel {
  // Models are only ever built as instances here, and every provider Norish
  // ships speaks v3. A bare model-id string has no provider to call through, and
  // a v2 model predates the middleware this wraps it in; both pass through
  // untouched rather than being wrapped in something they cannot answer.
  if (typeof model === "string" || model.specificationVersion !== "v3") return model;

  return wrapLanguageModel({ model, middleware: temperatureFallbackMiddleware });
}

/** Test seam: forget everything learned about which models reject temperature. */
export function resetTemperatureFallbackCache(): void {
  modelsRejectingTemperature.clear();
}
