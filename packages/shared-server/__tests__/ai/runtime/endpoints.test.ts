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
});
