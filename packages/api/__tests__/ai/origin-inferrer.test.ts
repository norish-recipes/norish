// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

import { inferProvenanceForRecipe } from "@norish/api/ai/origin-inferrer";

// Mock AI module
vi.mock("ai", () => ({
  generateObject: vi.fn(),
  Output: {
    object: vi.fn(() => ({ schema: {} })),
  },
}));

// Mock prompt loader
vi.mock("@norish/shared-server/ai/prompts/loader", () => ({
  loadPrompt: vi.fn().mockResolvedValue("Mock Prompt"),
}));

// Mock server config
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isAIEnabled: vi.fn().mockResolvedValue(true),
  getAIConfig: vi.fn().mockResolvedValue({
    enabled: true,
    provider: "openai",
    model: "gpt-4o-mini",
    apiKey: "test-key",
  }),
}));

// Mock models and settings
vi.mock("@norish/shared-server/ai/providers", () => ({
  getModels: vi.fn().mockResolvedValue({ model: {}, providerName: "mock" }),
  getGenerationSettings: vi.fn().mockResolvedValue({}),
}));

// Mock logger
vi.mock("@norish/shared-server/logger", () => ({
  aiLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("inferOriginForRecipe", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { isAIEnabled } = await import("@norish/shared-server/config/server-config-loader");

    vi.mocked(isAIEnabled).mockResolvedValue(true);
  });

  const mockRecipe = {
    title: "Classic Margherita Pizza",
    description: "Traditional Italian pizza with tomatoes and mozzarella",
    ingredients: ["500g flour", "300ml water", "San Marzano tomatoes", "Mozzarella di Bufala"],
  };

  it("successfully infers origin when AI is enabled and returns valid data", async () => {
    const { generateObject } = await import("ai");

    vi.mocked(generateObject).mockResolvedValue({
      object: {
        originCountry: "IT",
        originRegion: "Campania",
        cuisines: ["Italian"],
        provenanceNote:
          "The combination of San Marzano tomatoes and Mozzarella di Bufala is iconic of Naples.",
      },
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    } as any);

    const result = await inferProvenanceForRecipe(mockRecipe);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.originCountry).toBe("IT");
      expect(result.data.originRegion).toBe("Campania");
      expect(result.data.cuisines).toContain("Italian");
      expect(result.usage?.totalTokens).toBe(150);
    }
  });

  it("returns an error when AI is disabled", async () => {
    const { isAIEnabled } = await import("@norish/shared-server/config/server-config-loader");

    vi.mocked(isAIEnabled).mockResolvedValue(false);

    const result = await inferProvenanceForRecipe(mockRecipe);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("AI_DISABLED");
    }
  });

  it("returns an error when no ingredients are provided", async () => {
    const result = await inferProvenanceForRecipe({
      ...mockRecipe,
      ingredients: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("INVALID_INPUT");
    }
  });

  it("returns an error when AI returns empty output", async () => {
    const { generateObject } = await import("ai");

    vi.mocked(generateObject).mockResolvedValue({
      object: null,
    } as any);

    const result = await inferProvenanceForRecipe(mockRecipe);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("EMPTY_RESPONSE");
    }
  });

  it("handles AI generation errors gracefully", async () => {
    const { generateObject } = await import("ai");

    // Change code mapping logic to match actual implementation
    vi.mocked(generateObject).mockRejectedValue(new Error("AI service unavailable"));

    const result = await inferProvenanceForRecipe(mockRecipe);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("PROVIDER_ERROR");
    }
  });
});
