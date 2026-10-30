import { describe, expect, it } from "vitest";

import {
  normalizeAzureEndpoint,
  normalizeOllamaEndpoint,
  normalizeOpenAICompatibleEndpoint,
} from "@norish/shared-server/ai/runtime/endpoints";

describe("endpoint normalisation", () => {
  it("drops every trailing slash before adding the path a provider needs", () => {
    expect(normalizeAzureEndpoint("https://x.openai.azure.com//")).toBe(
      "https://x.openai.azure.com/openai"
    );
    expect(normalizeAzureEndpoint("https://x.openai.azure.com/openai/")).toBe(
      "https://x.openai.azure.com/openai"
    );
    expect(normalizeOpenAICompatibleEndpoint("http://localhost:1234///")).toBe(
      "http://localhost:1234/v1"
    );
    expect(normalizeOllamaEndpoint("http://localhost:11434/api//")).toBe("http://localhost:11434");
    expect(normalizeOllamaEndpoint("http://localhost:11434")).toBe("http://localhost:11434");
  });

  it("uses an OpenAI-compatible endpoint whose path already names a version as written", () => {
    for (const endpoint of [
      "https://openrouter.ai/api/v1",
      "https://open.bigmodel.cn/api/paas/v4",
      "https://generativelanguage.googleapis.com/v1beta/openai",
      "https://gateway.ai.cloudflare.com/v1/account/gateway/compat",
    ]) {
      expect(normalizeOpenAICompatibleEndpoint(`${endpoint}/`)).toBe(endpoint);
    }
    expect(normalizeOpenAICompatibleEndpoint("https://openrouter.ai/api")).toBe(
      "https://openrouter.ai/api/v1"
    );
    expect(normalizeOpenAICompatibleEndpoint("http://v1.example.com:8080")).toBe(
      "http://v1.example.com:8080/v1"
    );
  });
});
