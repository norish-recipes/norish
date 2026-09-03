/**
 * Endpoint normalization — each rule exists exactly once.
 *
 * A configured endpoint is typed by a human, so it arrives in whichever shape
 * that provider's own documentation happens to print: with or without the
 * trailing slash, with or without the version segment. Every code path that
 * addresses the same endpoint has to agree on what it means, or the model
 * request and the connection test end up talking to different URLs — which is
 * exactly how a working OpenRouter configuration came to fail its own test
 * with a 404 while every real request succeeded (#537).
 *
 * So these live apart from the clients that use them: the provider factory, the
 * model listing, and the admin connection test all normalize through here
 * rather than each repeating the rule, and a package that only needs the rule
 * does not have to pull the AI SDK in behind it.
 */

/** The Azure SDK expects the /openai path suffix on a configured endpoint. */
export function normalizeAzureEndpoint(endpoint: string): string {
  const baseUrl = endpoint.replace(/\/+$/, "");

  return baseUrl.endsWith("/openai") ? baseUrl : `${baseUrl}/openai`;
}

/**
 * OpenAI-compatible endpoints are addressed under /v1.
 *
 * Both conventions people write are accepted and mean the same thing:
 * `https://openrouter.ai/api` and `https://openrouter.ai/api/v1` both address
 * `…/api/v1`, and a trailing slash never doubles the segment.
 */
export function normalizeOpenAICompatibleEndpoint(endpoint: string): string {
  const baseUrl = endpoint.replace(/\/+$/, "");

  return baseUrl.endsWith("/v1") ? baseUrl : `${baseUrl}/v1`;
}

/** Ollama is addressed at its host root, without a trailing slash or /api. */
export function normalizeOllamaEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, "").replace(/\/api$/, "");
}
