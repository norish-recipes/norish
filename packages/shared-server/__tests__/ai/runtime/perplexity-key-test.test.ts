// @vitest-environment node
/**
 * The AI form's Test button for Perplexity goes through the runtime: one tiny
 * question to the quickest Agent API preset on the provider the real requests
 * use, with a rejected key reported as such.
 */
import { APICallError } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.hoisted(() => vi.fn());
const logger = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText,
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getAIConfig: vi.fn(),
  getDecisionConfig: vi.fn(),
  getImageGenerationConfig: vi.fn(),
  getVideoConfig: vi.fn(),
  getPrompts: vi.fn(),
}));

vi.mock("@norish/shared-server/logger", () => ({
  aiLogger: logger,
  serverLogger: logger,
  createLogger: () => logger,
}));

const { testPerplexityKey } = await import("@norish/shared-server/ai/runtime/runtime");

function rejection(statusCode: number) {
  return new APICallError({
    message: "rejected",
    url: "https://api.perplexity.ai/v1/agent",
    requestBodyValues: {},
    statusCode,
  });
}

describe("testPerplexityKey", () => {
  beforeEach(() => {
    generateText.mockReset();
  });

  it("asks the fast preset one tiny question with the key as typed", async () => {
    generateText.mockResolvedValue({ text: "Hello" });

    await expect(testPerplexityKey("typed")).resolves.toEqual({ success: true });

    const request = generateText.mock.calls[0]![0];

    expect(request.model.provider).toMatch(/perplexity/);
    expect(request.model.modelId).toBe("fast");
    expect(request.maxOutputTokens).toBe(16);
  });

  it("reports a rejected key as an invalid key", async () => {
    generateText.mockRejectedValue(rejection(401));

    await expect(testPerplexityKey("bad")).resolves.toEqual({
      success: false,
      error: "Invalid API key",
    });
  });

  it("reports any other failure with the provider's reason", async () => {
    generateText.mockRejectedValue(rejection(500));

    const result = await testPerplexityKey("typed");

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
