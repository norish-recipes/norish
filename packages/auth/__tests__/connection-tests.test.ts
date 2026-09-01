/**
 * What URL the admin connection test actually asks for.
 *
 * #537 was a tester that appended `/v1` unconditionally: an OpenRouter base
 * URL of `https://openrouter.ai/api/v1` became `…/api/v1/v1/models` and
 * answered 404, while every enrichment job through the same saved config
 * succeeded, because the AI Runtime normalizes the same endpoint differently.
 * So these assert the requested URL, not a stubbed result — the two paths
 * agreeing is the fix.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { normalizeOpenAICompatibleEndpoint } from "@norish/shared-server/ai/runtime/endpoints";
import { testAIEndpoint } from "@norish/auth/connection-tests";

/** URLs the stubbed transport was asked for, in order. */
let requested: string[] = [];

beforeEach(() => {
  requested = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requested.push(String(url));

      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function urlFor(endpoint: string, provider = "generic-openai"): Promise<string> {
  await testAIEndpoint({ provider, endpoint, apiKey: "test-key" });

  return requested[0] ?? "";
}

describe("testAIEndpoint", () => {
  it("does not double the version segment on a base URL that already carries it", async () => {
    expect(await urlFor("https://openrouter.ai/api/v1")).toBe(
      "https://openrouter.ai/api/v1/models"
    );
  });

  it("adds the version segment to a base URL without one", async () => {
    expect(await urlFor("https://openrouter.ai/api")).toBe("https://openrouter.ai/api/v1/models");
  });

  it("tolerates a trailing slash", async () => {
    expect(await urlFor("https://openrouter.ai/api/v1/")).toBe(
      "https://openrouter.ai/api/v1/models"
    );
  });

  it("asks the same base URL the AI Runtime builds its client on", async () => {
    for (const endpoint of [
      "https://openrouter.ai/api/v1",
      "https://openrouter.ai/api",
      "http://localhost:1234/v1/",
    ]) {
      requested = [];
      expect(await urlFor(endpoint)).toBe(
        `${normalizeOpenAICompatibleEndpoint(endpoint)}/models`
      );
    }
  });

  it("normalizes an LM Studio endpoint the same way", async () => {
    expect(await urlFor("http://localhost:1234/v1", "lm-studio")).toBe(
      "http://localhost:1234/v1/models"
    );
  });

  it("addresses Ollama at its host root", async () => {
    expect(await urlFor("http://localhost:11434/api", "ollama")).toBe(
      "http://localhost:11434/api/tags"
    );
  });

  it("reports a refusal rather than claiming success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 404 })));

    const result = await testAIEndpoint({
      provider: "generic-openai",
      endpoint: "https://openrouter.ai/api/v1",
      apiKey: "test-key",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("404");
  });
});
