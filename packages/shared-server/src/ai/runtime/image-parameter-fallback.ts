/**
 * Image parameter fallback - keeps image generation working on models that
 * refuse a parameter the request carries (ADR-0014).
 *
 * Three parameters an image request may carry are preferences, not
 * requirements: `quality`, the tier Norish asks for, `background`, asked
 * transparent for an Ingredient Icon, and `response_format`, which
 * `@ai-sdk/openai` adds itself to every model whose name it does not know
 * returns base64 by default. That knowledge is a table of name prefixes, so a
 * GPT Image model reached under another name (an Azure deployment is named by
 * its owner) gets it, and refuses it with a 400. DALL·E refuses the `low`
 * tier and a transparent background the same way. So a model that refuses
 * one of them gets the same request again
 * without it, and the refusal is remembered for the life of the process, so
 * only its first request pays for the rejected round trip. The fetch the
 * image model is built with leaves remembered parameters out of the body,
 * which reaches the one the SDK adds as well as the ones Norish passes.
 */
import { APICallError } from "ai";

/**
 * The parameters a request may go without: the model draws at its own
 * default instead, or on a background a cut-out removes.
 */
const DROPPABLE = ["response_format", "quality", "background"] as const;

/** What each image model refused, keyed by `provider:model`. Process-local on purpose (ADR-0014). */
const refusedByModel = new Map<string, Set<string>>();

export function imageModelKey(provider: string, model: string): string {
  return `${provider}:${model}`;
}

/** The parameters an image model is known to refuse. */
export function refusedImageParameters(key: string): ReadonlySet<string> {
  return refusedByModel.get(key) ?? new Set();
}

/** Remember that an image model refused a parameter. */
export function rememberRefusedImageParameter(key: string, parameter: string): void {
  refusedByModel.set(key, new Set([...refusedImageParameters(key), parameter]));
}

/**
 * The droppable parameter a provider's request-shape rejection names, or
 * null: OpenAI names it in `error.param`, and its message quotes it.
 */
export function refusedImageParameter(error: unknown): string | null {
  if (!APICallError.isInstance(error)) return null;
  if (error.statusCode !== 400 && error.statusCode !== 422) return null;

  const named = (error.data as { error?: { param?: unknown } } | undefined)?.error?.param;
  const text = `${error.message} ${typeof error.responseBody === "string" ? error.responseBody : ""}`;

  return (
    DROPPABLE.find((parameter) => named === parameter) ??
    DROPPABLE.find((parameter) => text.includes(`'${parameter}'`)) ??
    null
  );
}

/** A fetch that leaves the parameters this model refused out of a JSON request body. */
export function withoutRefusedImageParameters(fetchImpl: typeof fetch, key: string): typeof fetch {
  return (url, init) => {
    const refused = refusedImageParameters(key);

    if (refused.size === 0 || typeof init?.body !== "string") return fetchImpl(url, init);

    let body: Record<string, unknown>;

    try {
      body = JSON.parse(init.body) as Record<string, unknown>;
    } catch {
      return fetchImpl(url, init);
    }

    for (const parameter of refused) delete body[parameter];

    return fetchImpl(url, { ...init, body: JSON.stringify(body) });
  };
}

/** Test seam: forget every refusal learned. */
export function resetImageParameterFallback(): void {
  refusedByModel.clear();
}
