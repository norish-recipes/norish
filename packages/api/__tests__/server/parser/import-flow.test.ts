// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExtractRecipeWithAI = vi.fn();
const mockIsVideoUrl = vi.fn(() => false);
const mockFetchViaPlaywright = vi.fn();
const mockCallRecipeScrapersParser = vi.fn();
const mockAdaptRecipeScrapersResponse = vi.fn();
const mockTryLegacyStructuredRecipeParsing = vi.fn();
const mockProcessVideoRecipe = vi.fn();
const mockIsAIEnabled = vi.fn();
const mockShouldAlwaysUseAI = vi.fn();
const mockIsVideoParsingEnabled = vi.fn();
const mockGetContentIndicators = vi.fn();
const mockShouldUseLegacyRecipeParserRollback = vi.fn();
const mockServerConfig = {
  LEGACY_RECIPE_PARSER_ROLLBACK: false,
  UPLOADS_DIR: "/tmp/uploads",
  MAX_IMAGE_FILE_SIZE: 10 * 1024 * 1024,
  YT_DLP_BIN_DIR: "/tmp/bin",
  YT_DLP_VERSION: "2025.11.12",
};

vi.mock("@norish/api/ai/recipe-parser", () => ({
  extractRecipeWithAI: mockExtractRecipeWithAI,
}));

vi.mock("@norish/api/helpers", () => ({
  isVideoUrl: mockIsVideoUrl,
}));

vi.mock("@norish/api/parser/fetch", () => ({
  fetchViaPlaywright: mockFetchViaPlaywright,
}));

vi.mock("@norish/api/parser/python/client", () => ({
  callRecipeScrapersParser: mockCallRecipeScrapersParser,
}));

vi.mock("@norish/api/parser/python/adapter", () => ({
  adaptRecipeScrapersResponse: mockAdaptRecipeScrapersResponse,
}));

vi.mock("@norish/api/parser/legacy", () => ({
  tryLegacyStructuredRecipeParsing: mockTryLegacyStructuredRecipeParsing,
}));

vi.mock("@norish/api/video/processor", () => ({
  processVideoRecipe: mockProcessVideoRecipe,
}));

vi.mock("@norish/config/server-config-loader", () => ({
  getContentIndicators: mockGetContentIndicators,
  isAIEnabled: mockIsAIEnabled,
  isVideoParsingEnabled: mockIsVideoParsingEnabled,
  shouldAlwaysUseAI: mockShouldAlwaysUseAI,
  shouldUseLegacyRecipeParserRollback: mockShouldUseLegacyRecipeParserRollback,
}));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: mockServerConfig,
}));

const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(),
};

vi.mock("@norish/shared-server/logger", () => ({
  parserLogger: mockLogger,
  serverLogger: mockLogger,
  createLogger: vi.fn(() => mockLogger),
}));

describe("parseRecipeFromUrl import flow", () => {
  const structuredRecipe = {
    id: "recipe-1",
    name: "Structured Recipe",
    url: "https://example.com/recipe",
    description: undefined,
    notes: undefined,
    image: undefined,
    servings: 2,
    prepMinutes: undefined,
    cookMinutes: undefined,
    totalMinutes: undefined,
    calories: null,
    fat: null,
    carbs: null,
    protein: null,
    systemUsed: "metric",
    recipeIngredients: [
      {
        ingredientId: null,
        ingredientName: "egg",
        amount: 1,
        unit: null,
        systemUsed: "metric",
        order: 0,
      },
    ],
    steps: [{ step: "Cook it", systemUsed: "metric", order: 1 }],
    tags: [],
    categories: [],
    images: [],
    videos: [],
  };

  const aiRecipe = {
    ...structuredRecipe,
    name: "AI Recipe",
  };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mockIsVideoUrl.mockReturnValue(false);
    mockFetchViaPlaywright.mockResolvedValue("<html><body>recipe html</body></html>");
    mockIsAIEnabled.mockResolvedValue(true);
    mockShouldAlwaysUseAI.mockResolvedValue(false);
    mockIsVideoParsingEnabled.mockResolvedValue(false);
    mockGetContentIndicators.mockResolvedValue({
      schemaIndicators: ["recipe"],
      contentIndicators: ["ingredient", "instructions"],
    });
    mockShouldUseLegacyRecipeParserRollback.mockReturnValue(false);
    mockServerConfig.LEGACY_RECIPE_PARSER_ROLLBACK = false;
    mockCallRecipeScrapersParser.mockResolvedValue({
      ok: true,
      canonicalUrl: "https://example.com/recipe",
      parser: {
        mode: "supported",
        scraper: "AllRecipes",
        host: "example.com",
        siteName: "Example",
        version: "15.10.0",
      },
      recipe: {},
      media: { images: [], videos: [] },
    });
    mockAdaptRecipeScrapersResponse.mockResolvedValue(structuredRecipe);
    mockTryLegacyStructuredRecipeParsing.mockResolvedValue(null);
    mockProcessVideoRecipe.mockResolvedValue(structuredRecipe);
    mockExtractRecipeWithAI.mockResolvedValue({ success: true, data: aiRecipe });
  });

  it("uses the existing video pipeline for video imports", { timeout: 15000 }, async () => {
    mockIsVideoUrl.mockReturnValue(true);
    mockIsVideoParsingEnabled.mockResolvedValue(true);

    const { parseRecipeFromUrl } = await import("@norish/api/parser");
    const result = await parseRecipeFromUrl("https://example.com/video", "recipe-1", ["dairy"]);

    expect(result).toEqual({ recipe: structuredRecipe, usedAI: true });
    expect(mockProcessVideoRecipe).toHaveBeenCalledWith(
      "https://example.com/video",
      "recipe-1",
      ["dairy"],
      undefined
    );
    expect(mockFetchViaPlaywright).not.toHaveBeenCalled();
    expect(mockCallRecipeScrapersParser).not.toHaveBeenCalled();
    expect(mockExtractRecipeWithAI).not.toHaveBeenCalled();
  });

  it("uses AI directly when forceAI is true", async () => {
    const { parseRecipeFromUrl } = await import("@norish/api/parser");
    const result = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1", [], true);

    expect(result).toEqual({ recipe: aiRecipe, usedAI: true });
    expect(mockCallRecipeScrapersParser).not.toHaveBeenCalled();
    expect(mockExtractRecipeWithAI).toHaveBeenCalled();
  });

  it("uses AI directly when alwaysUseAI is enabled", async () => {
    mockShouldAlwaysUseAI.mockResolvedValue(true);

    const { parseRecipeFromUrl } = await import("@norish/api/parser");
    const result = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1");

    expect(result).toEqual({ recipe: aiRecipe, usedAI: true });
    expect(mockCallRecipeScrapersParser).not.toHaveBeenCalled();
  });

  it("returns a successful Python parser result without running AI", async () => {
    const { parseRecipeFromUrl } = await import("@norish/api/parser");
    const result = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1");

    expect(result).toEqual({ recipe: structuredRecipe, usedAI: false });
    expect(mockCallRecipeScrapersParser).toHaveBeenCalled();
    expect(mockGetContentIndicators).not.toHaveBeenCalled();
    expect(mockExtractRecipeWithAI).not.toHaveBeenCalled();
  });

  it("falls back to AI when the Python parser output is invalid and the page still looks recipe-like", async () => {
    mockAdaptRecipeScrapersResponse.mockResolvedValue(null);

    const { parseRecipeFromUrl } = await import("@norish/api/parser");
    const result = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1");

    expect(result).toEqual({ recipe: aiRecipe, usedAI: true });
    expect(mockGetContentIndicators).toHaveBeenCalled();
  });

  it("falls back to AI on structured parser failure when AI is enabled and the page is recipe-like", async () => {
    mockCallRecipeScrapersParser.mockResolvedValue({
      ok: false,
      error: "WebsiteNotImplementedError",
      message: "unsupported",
      parser: { mode: "supported", scraper: "unknown", version: "15.10.0" },
    });

    const { parseRecipeFromUrl } = await import("@norish/api/parser");
    const result = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1");

    expect(result).toEqual({ recipe: aiRecipe, usedAI: true });
    expect(mockExtractRecipeWithAI).toHaveBeenCalled();
  });

  it("hard-fails when parser failure occurs and the page does not look recipe-like", async () => {
    mockCallRecipeScrapersParser.mockResolvedValue({
      ok: false,
      error: "NoSchemaFoundInWildMode",
      message: "no schema",
      parser: { mode: "wild", scraper: "unknown", version: "15.10.0" },
    });
    mockFetchViaPlaywright.mockResolvedValue("<html><body>plain text</body></html>");

    const { parseRecipeFromUrl } = await import("@norish/api/parser");

    await expect(parseRecipeFromUrl("https://example.com/page", "recipe-1")).rejects.toThrow(
      "Page does not appear to contain a recipe."
    );
    expect(mockExtractRecipeWithAI).not.toHaveBeenCalled();
  });

  it("hard-fails when parser failure occurs and AI is disabled", async () => {
    mockCallRecipeScrapersParser.mockResolvedValue({
      ok: false,
      error: "RecipeSchemaNotFound",
      message: "missing schema",
      parser: { mode: "supported", scraper: "Example", version: "15.10.0" },
    });
    mockIsAIEnabled.mockResolvedValue(false);

    const { parseRecipeFromUrl } = await import("@norish/api/parser");

    await expect(parseRecipeFromUrl("https://example.com/page", "recipe-1")).rejects.toThrow(
      "Page does not appear to contain a recipe."
    );
    expect(mockExtractRecipeWithAI).not.toHaveBeenCalled();
  });

  it("uses the deprecated legacy parser only when the rollback flag is enabled", async () => {
    mockShouldUseLegacyRecipeParserRollback.mockReturnValue(true);
    mockServerConfig.LEGACY_RECIPE_PARSER_ROLLBACK = true;
    mockTryLegacyStructuredRecipeParsing.mockResolvedValue(structuredRecipe);

    const { parseRecipeFromUrl } = await import("@norish/api/parser");
    const result = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1");

    expect(result).toEqual({ recipe: structuredRecipe, usedAI: false });
    expect(mockTryLegacyStructuredRecipeParsing).toHaveBeenCalled();
    expect(mockCallRecipeScrapersParser).not.toHaveBeenCalled();
  });
});
