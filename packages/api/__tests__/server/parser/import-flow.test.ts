// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockExtractRecipeWithAI = vi.fn();
const mockIsVideoUrl = vi.fn(() => false);
const mockFetchRenderedPage = vi.fn();
const mockRenderStatus = vi.fn((): number | null => 200);
const mockPlainFetch = vi.fn();
const mockCallRecipeScrapersParser = vi.fn();
const mockAdaptRecipeScrapersResponse = vi.fn();
const mockCollectIngredientStrings = vi.fn();
const mockProcessVideoRecipe = vi.fn();
const mockIsAIEnabled = vi.fn();
const mockShouldAlwaysUseAI = vi.fn();
const mockIsVideoParsingEnabled = vi.fn();
const mockGetContentIndicators = vi.fn();
const mockIsRecipe = vi.fn();
const mockIsParseComplete = vi.fn();
const mockServerConfig = {
  UPLOADS_DIR: "/tmp/uploads",
  MAX_IMAGE_FILE_SIZE: 10 * 1024 * 1024,
  YT_DLP_BIN_DIR: "/tmp/bin",
  YT_DLP_VERSION: "2025.11.12",
};

vi.mock("@norish/api/parser/recipe-extraction", () => ({
  extractRecipeWithAI: mockExtractRecipeWithAI,
}));

vi.mock("@norish/api/parser/import-triage", () => ({
  isRecipe: mockIsRecipe,
  isParseComplete: mockIsParseComplete,
}));

vi.mock("@norish/shared/lib/helpers", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared/lib/helpers")>()),
  isVideoUrl: mockIsVideoUrl,
}));

vi.mock("@norish/api/parser/fetch", () => ({
  isBotCheck: (html: string) => html.includes("Just a moment"),
  plainFetch: mockPlainFetch,
  renderPage: async (...args: unknown[]) => ({
    html: await mockFetchRenderedPage(...args),
    status: mockRenderStatus(),
  }),
}));

vi.mock("@norish/api/parser/python/client", () => ({
  callRecipeScrapersParser: mockCallRecipeScrapersParser,
}));

vi.mock("@norish/api/parser/python/adapter", () => ({
  adaptRecipeScrapersResponse: mockAdaptRecipeScrapersResponse,
  collectIngredientStrings: mockCollectIngredientStrings,
}));

vi.mock("@norish/api/video/processor", () => ({
  processVideoRecipe: mockProcessVideoRecipe,
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getContentIndicators: mockGetContentIndicators,
  isAIEnabled: mockIsAIEnabled,
  isVideoParsingEnabled: mockIsVideoParsingEnabled,
  shouldAlwaysUseAI: mockShouldAlwaysUseAI,
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

    mockIsVideoUrl.mockReturnValue(false);
    mockRenderStatus.mockReturnValue(200);
    // The plain fetch finds no recipe, so every page is rendered as before.
    mockPlainFetch.mockResolvedValue({ html: "", status: null, url: "" });
    // No Decision Model: triage has no opinion and every rule is today's.
    mockIsRecipe.mockResolvedValue(null);
    mockIsParseComplete.mockResolvedValue(null);
    mockFetchRenderedPage.mockResolvedValue("<html><body>recipe html</body></html>");
    mockIsAIEnabled.mockResolvedValue(true);
    mockShouldAlwaysUseAI.mockResolvedValue(false);
    mockIsVideoParsingEnabled.mockResolvedValue(false);
    mockGetContentIndicators.mockResolvedValue({
      schemaIndicators: ["recipe"],
      contentIndicators: ["ingredient", "instructions"],
    });
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
    mockCollectIngredientStrings.mockReturnValue(["1 egg"]);
    mockProcessVideoRecipe.mockResolvedValue(structuredRecipe);
    mockExtractRecipeWithAI.mockResolvedValue(aiRecipe);
  });

  it("uses the existing video pipeline for video imports", { timeout: 15000 }, async () => {
    mockIsVideoUrl.mockReturnValue(true);
    mockIsVideoParsingEnabled.mockResolvedValue(true);

    const { parseRecipeFromUrl } = await import("@norish/api/parser");
    const result = await parseRecipeFromUrl("https://example.com/video", "recipe-1");

    expect(result).toEqual({ recipe: structuredRecipe, usedAI: true });
    expect(mockProcessVideoRecipe).toHaveBeenCalledWith(
      "https://example.com/video",
      "recipe-1",
      undefined
    );
    expect(mockFetchRenderedPage).not.toHaveBeenCalled();
    expect(mockCallRecipeScrapersParser).not.toHaveBeenCalled();
    expect(mockExtractRecipeWithAI).not.toHaveBeenCalled();
  });

  it("refuses a video import naming AI before anything is downloaded when AI is disabled", async () => {
    mockIsVideoUrl.mockReturnValue(true);
    mockIsAIEnabled.mockResolvedValue(false);
    mockIsVideoParsingEnabled.mockResolvedValue(false);

    const { parseRecipeFromUrl } = await import("@norish/api/parser");

    await expect(parseRecipeFromUrl("https://example.com/video", "recipe-1")).rejects.toThrow(
      /AI features are not enabled/
    );
    expect(mockProcessVideoRecipe).not.toHaveBeenCalled();
    expect(mockFetchRenderedPage).not.toHaveBeenCalled();
    expect(mockExtractRecipeWithAI).not.toHaveBeenCalled();
  });

  it("refuses a video import naming video parsing when AI is on but video parsing is off", async () => {
    mockIsVideoUrl.mockReturnValue(true);
    mockIsAIEnabled.mockResolvedValue(true);
    mockIsVideoParsingEnabled.mockResolvedValue(false);

    const { parseRecipeFromUrl } = await import("@norish/api/parser");

    await expect(parseRecipeFromUrl("https://example.com/video", "recipe-1")).rejects.toThrow(
      "Video recipe parsing is not enabled."
    );
    expect(mockProcessVideoRecipe).not.toHaveBeenCalled();
  });

  describe("plain fetch before the browser", () => {
    const withJsonLd = `<html><head><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Plain Recipe",
    })}</script></head><body></body></html>`;
    const tokens = [
      {
        id: "00000000-0000-0000-0000-000000000000",
        userId: "user-1",
        domain: "example.com",
        name: "session",
        value: "s",
        type: "cookie" as const,
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
      },
    ];

    it("parses a plain page that holds a JSON-LD recipe without rendering it", async () => {
      mockPlainFetch.mockResolvedValue({
        html: withJsonLd,
        status: 200,
        url: "https://example.com/recipe",
      });

      const { parseRecipeFromUrl } = await import("@norish/api/parser");
      const result = await parseRecipeFromUrl(
        "https://example.com/recipe",
        "recipe-1",
        false,
        tokens
      );

      expect(result).toEqual({ recipe: structuredRecipe, usedAI: false });
      expect(mockPlainFetch).toHaveBeenCalledWith("https://example.com/recipe", "Norish", {
        tokens,
      });
      expect(mockCallRecipeScrapersParser).toHaveBeenCalledWith({
        url: "https://example.com/recipe",
        html: withJsonLd,
      });
      expect(mockFetchRenderedPage).not.toHaveBeenCalled();
    });

    it.each([
      ["has no JSON-LD recipe", { html: "<html><body>a recipe</body></html>", status: 200 }],
      ["was not a 200", { html: withJsonLd, status: 403 }],
      ["got no answer", { html: "", status: null }],
    ])("renders the page when the plain fetch %s", async (_case, plain) => {
      mockPlainFetch.mockResolvedValue({ ...plain, url: "https://example.com/recipe" });

      const { parseRecipeFromUrl } = await import("@norish/api/parser");

      await parseRecipeFromUrl("https://example.com/recipe", "recipe-1", false, tokens);

      expect(mockFetchRenderedPage).toHaveBeenCalledWith("https://example.com/recipe", tokens);
    });

    it("reads the plain page when no Page Renderer reads it", async () => {
      const plainHtml = "<html><body>a recipe</body></html>";

      mockPlainFetch.mockResolvedValue({ html: plainHtml, status: 200, url: "" });
      mockFetchRenderedPage.mockResolvedValue("");
      mockRenderStatus.mockReturnValue(null);

      const { parseRecipeFromUrl } = await import("@norish/api/parser");

      await expect(
        parseRecipeFromUrl("https://example.com/recipe", "recipe-1")
      ).resolves.toMatchObject({ recipe: structuredRecipe });
      expect(mockCallRecipeScrapersParser).toHaveBeenCalledWith({
        url: "https://example.com/recipe",
        html: plainHtml,
      });
    });

    it.each([
      ["names the site that refused", 403, "example.com refused the request (HTTP 403)"],
      ["cannot fetch", 200, "Cannot fetch recipe page."],
    ])(
      "%s when the plain page is a bot check no Page Renderer gets past",
      async (_case, status, message) => {
        mockPlainFetch.mockResolvedValue({
          html: "<html><head><title>Just a moment...</title></head></html>",
          status,
          url: "",
        });
        mockFetchRenderedPage.mockResolvedValue("");
        mockRenderStatus.mockReturnValue(null);

        const { parseRecipeFromUrl } = await import("@norish/api/parser");

        await expect(parseRecipeFromUrl("https://example.com/recipe", "recipe-1")).rejects.toThrow(
          message
        );
        expect(mockCallRecipeScrapersParser).not.toHaveBeenCalled();
      }
    );

    it("names a private address the server refused, and renders nothing", async () => {
      mockPlainFetch.mockResolvedValue({
        html: "",
        status: null,
        url: "http://192.168.1.1/",
        refused: true,
      });

      const { parseRecipeFromUrl } = await import("@norish/api/parser");

      await expect(parseRecipeFromUrl("http://192.168.1.1/", "recipe-1")).rejects.toThrow(
        "Imports from private network addresses are not allowed on this server."
      );
      expect(mockFetchRenderedPage).not.toHaveBeenCalled();
    });
  });

  it("uses AI directly when forceAI is true", async () => {
    const { parseRecipeFromUrl } = await import("@norish/api/parser");
    const result = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1", [], true);

    expect(result).toMatchObject({ recipe: aiRecipe, usedAI: true });
    expect(mockCallRecipeScrapersParser).not.toHaveBeenCalled();
    expect(mockExtractRecipeWithAI).toHaveBeenCalled();
  });

  describe("AI extraction from JSON-LD without steps", () => {
    const withJsonLd = `<html><head><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Lentil soup",
    })}</script></head><body>the method</body></html>`;
    const stepless = { ...aiRecipe, name: "JSON-LD Recipe", steps: [] };

    beforeEach(() => {
      mockFetchRenderedPage.mockResolvedValue(withJsonLd);
    });

    it("tries the full HTML for the method", async () => {
      mockExtractRecipeWithAI.mockResolvedValueOnce(stepless).mockResolvedValueOnce(aiRecipe);

      const { parseRecipeFromUrl } = await import("@norish/api/parser");
      const result = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1", true);

      expect(result).toMatchObject({ recipe: aiRecipe, usedAI: true });
      expect(mockExtractRecipeWithAI).toHaveBeenLastCalledWith(
        withJsonLd,
        "recipe-1",
        "https://example.com/recipe",
        withJsonLd
      );
    });

    it("reads the sections the scraper found in place of the JSON-LD's flat list (#685)", async () => {
      const sectioned = ["# For the mash", "1 kg potatoes", "# For the sauce", "500 g lentils"];

      mockIsParseComplete.mockResolvedValue(false);
      mockCollectIngredientStrings.mockReturnValue(sectioned);

      const { parseRecipeFromUrl } = await import("@norish/api/parser");

      await parseRecipeFromUrl("https://example.com/recipe", "recipe-1");

      const [input] = mockExtractRecipeWithAI.mock.calls[0] as [string];

      expect(JSON.parse(input)).toMatchObject([
        { name: "Lentil soup", recipeIngredient: sectioned },
      ]);
    });

    it("keeps the JSON-LD's own list when the scraper found no sections", async () => {
      mockIsParseComplete.mockResolvedValue(false);

      const { parseRecipeFromUrl } = await import("@norish/api/parser");

      await parseRecipeFromUrl("https://example.com/recipe", "recipe-1");

      const [input] = mockExtractRecipeWithAI.mock.calls[0] as [string];

      expect(JSON.parse(input)[0]).not.toHaveProperty("recipeIngredient");
    });

    it("keeps the JSON-LD result when the full HTML has no steps either", async () => {
      mockExtractRecipeWithAI
        .mockResolvedValueOnce(stepless)
        .mockResolvedValueOnce({ ...aiRecipe, steps: [] });

      const { parseRecipeFromUrl } = await import("@norish/api/parser");
      const result = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1", true);

      expect(result).toMatchObject({ recipe: stepless, usedAI: true });
    });
  });

  it("uses AI directly when alwaysUseAI is enabled", async () => {
    mockShouldAlwaysUseAI.mockResolvedValue(true);

    const { parseRecipeFromUrl } = await import("@norish/api/parser");
    const result = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1");

    expect(result).toMatchObject({ recipe: aiRecipe, usedAI: true });
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

    expect(result).toMatchObject({ recipe: aiRecipe, usedAI: true });
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

    expect(result).toMatchObject({ recipe: aiRecipe, usedAI: true });
    expect(mockExtractRecipeWithAI).toHaveBeenCalled();
  });

  it("hard-fails when parser failure occurs and the page does not look recipe-like", async () => {
    mockCallRecipeScrapersParser.mockResolvedValue({
      ok: false,
      error: "NoSchemaFoundInWildMode",
      message: "no schema",
      parser: { mode: "wild", scraper: "unknown", version: "15.10.0" },
    });
    mockFetchRenderedPage.mockResolvedValue("<html><body>plain text</body></html>");

    const { parseRecipeFromUrl } = await import("@norish/api/parser");

    await expect(parseRecipeFromUrl("https://example.com/page", "recipe-1")).rejects.toThrow(
      "Page does not appear to contain a recipe."
    );
    expect(mockExtractRecipeWithAI).not.toHaveBeenCalled();
  });

  it("carries the Python parser's raw answer when its recipe has no title", async () => {
    const raw = {
      ok: true,
      canonicalUrl: "https://example.com/recipe",
      parser: { mode: "wild", scraper: "SchemaScraper", version: "15.12.0" },
      recipe: { title: "", ingredients: ["1 egg"], instructions: "Cook it" },
      media: { images: [], videos: [] },
      unexpected: "kept, though the contract does not know it",
    };

    mockCallRecipeScrapersParser.mockResolvedValue({ ...raw, raw });
    mockAdaptRecipeScrapersResponse.mockResolvedValue({ ...structuredRecipe, name: "" });
    mockIsAIEnabled.mockResolvedValue(false);

    const { parseRecipeFromUrl } = await import("@norish/api/parser");
    const error = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1").catch(
      (err: unknown) => err
    );

    expect(error).toMatchObject({
      name: "ErrorWithDetail",
      message: "Python parser returned recipe data without a valid title",
      detail: {
        pythonParser: raw,
        page: expect.objectContaining({ htmlLength: expect.any(Number) }),
        aiFallback: "disabled",
      },
    });
  });

  it("carries why the Python parser gave no answer when the request itself failed", async () => {
    const { ErrorWithDetail } = await import("@norish/shared/lib/error-extensions");

    mockCallRecipeScrapersParser.mockRejectedValue(
      new ErrorWithDetail("Recipe parser API request failed with status 500", {
        status: 500,
        body: "Internal Server Error",
      })
    );
    mockIsAIEnabled.mockResolvedValue(false);

    const { parseRecipeFromUrl } = await import("@norish/api/parser");

    await expect(
      parseRecipeFromUrl("https://example.com/recipe", "recipe-1")
    ).rejects.toMatchObject({
      detail: { pythonParser: { status: 500, body: "Internal Server Error" } },
    });
  });

  it("still reports the Python parser's answer when AI extraction stands in for it", async () => {
    const raw = { ok: true, recipe: { title: null }, parser: { scraper: "SchemaScraper" } };

    mockCallRecipeScrapersParser.mockResolvedValue({ ...raw, raw });
    mockAdaptRecipeScrapersResponse.mockResolvedValue({ ...structuredRecipe, name: "" });

    const { parseRecipeFromUrl } = await import("@norish/api/parser");
    const result = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1");

    expect(result).toEqual({
      recipe: aiRecipe,
      usedAI: true,
      parserDiagnostics: {
        pythonParser: raw,
        page: expect.objectContaining({ text: "recipe html" }),
        aiFallback: "used",
      },
    });
  });

  it("names the site that refused the request instead of blaming the parser", async () => {
    mockRenderStatus.mockReturnValue(403);
    mockCallRecipeScrapersParser.mockResolvedValue({
      ok: true,
      parser: { mode: "supported", scraper: "AlbertHeijn", version: "15.12.0" },
      recipe: { host: "ah.nl", instructions: "" },
      media: { images: [], videos: [] },
      raw: { ok: true },
    });
    mockAdaptRecipeScrapersResponse.mockResolvedValue({ ...structuredRecipe, name: "" });
    mockFetchRenderedPage.mockResolvedValue(
      "<html><head><title>Access Denied</title></head><body>Access Denied recipe ingredient instructions</body></html>"
    );

    const { parseRecipeFromUrl } = await import("@norish/api/parser");

    await expect(
      parseRecipeFromUrl("https://www.ah.nl/allerhande/recept/R-R1202415", "recipe-1")
    ).rejects.toMatchObject({
      message: "ah.nl refused the request (HTTP 403)",
      detail: {
        aiFallback: "skipped: the site refused the request",
        page: expect.objectContaining({ title: "Access Denied" }),
      },
    });
    expect(mockExtractRecipeWithAI).not.toHaveBeenCalled();
  });

  it("names the site that refused the plain fetch when a solver hands back its refusal page", async () => {
    mockPlainFetch.mockResolvedValue({ html: "", status: 403, url: "" });
    mockRenderStatus.mockReturnValue(null);
    mockAdaptRecipeScrapersResponse.mockResolvedValue({ ...structuredRecipe, name: "" });
    mockFetchRenderedPage.mockResolvedValue(
      "<html><head><title>Access Denied</title></head><body>Access Denied</body></html>"
    );

    const { parseRecipeFromUrl } = await import("@norish/api/parser");

    await expect(
      parseRecipeFromUrl("https://www.ah.nl/allerhande/recept/R-R1202415", "recipe-1")
    ).rejects.toThrow("ah.nl refused the request (HTTP 403)");
  });

  it("keeps a recipe that parsed even though the first answer was a refusal", async () => {
    mockRenderStatus.mockReturnValue(429);

    const { parseRecipeFromUrl } = await import("@norish/api/parser");

    await expect(
      parseRecipeFromUrl("https://example.com/recipe", "recipe-1")
    ).resolves.toMatchObject({ recipe: structuredRecipe, usedAI: false });
  });

  it("says AI was skipped when the page the parser failed on is not a recipe", async () => {
    mockCallRecipeScrapersParser.mockResolvedValue({
      ok: false,
      error: "RecipeSchemaNotFound",
      message: "missing schema",
      raw: { ok: false },
    });
    mockFetchRenderedPage.mockResolvedValue(
      "<html><head><title>Access Denied</title></head><body><h1>Access Denied</h1></body></html>"
    );

    const { parseRecipeFromUrl } = await import("@norish/api/parser");

    await expect(parseRecipeFromUrl("https://example.com/page", "recipe-1")).rejects.toMatchObject({
      detail: {
        aiFallback: "skipped: the page does not look like a recipe",
        page: expect.objectContaining({ title: "Access Denied" }),
      },
    });
    expect(mockExtractRecipeWithAI).not.toHaveBeenCalled();
  });

  it("says AI was tried when extraction found nothing either", async () => {
    mockCallRecipeScrapersParser.mockResolvedValue({
      ok: false,
      error: "WebsiteNotImplementedError",
      message: "unsupported",
      raw: { ok: false },
    });
    mockExtractRecipeWithAI.mockRejectedValue(new Error("no recipe"));

    const { parseRecipeFromUrl } = await import("@norish/api/parser");

    await expect(
      parseRecipeFromUrl("https://example.com/recipe", "recipe-1")
    ).rejects.toMatchObject({ detail: { aiFallback: "tried: extraction found no recipe" } });
    expect(mockExtractRecipeWithAI).toHaveBeenCalled();
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

  describe("import triage with a Decision Model", () => {
    const notARecipe = {
      ok: false,
      error: "NoSchemaFoundInWildMode",
      message: "no schema",
      parser: { mode: "wild", scraper: "unknown", version: "15.10.0" },
    };

    it("refuses a page the Decision Model is sure is not a recipe, after one question and no extraction", async () => {
      mockCallRecipeScrapersParser.mockResolvedValue(notARecipe);
      // The keyword rule would have said yes; the Decision's clear no wins.
      mockFetchRenderedPage.mockResolvedValue(
        "<html><body><p>ingredient instructions</p></body></html>"
      );
      mockIsRecipe.mockResolvedValue(false);

      const { parseRecipeFromUrl } = await import("@norish/api/parser");

      await expect(
        parseRecipeFromUrl("https://example.com/page", "recipe-1")
      ).rejects.toMatchObject({
        message: "This page doesn't look like a recipe.",
        // The job monitor still sees the parser's own reply.
        detail: { aiFallback: "skipped: the page does not look like a recipe" },
      });
      expect(mockIsRecipe).toHaveBeenCalledTimes(1);
      // The question is asked of the sanitized text, not the raw markup.
      expect(mockIsRecipe).toHaveBeenCalledWith("ingredient instructions");
      expect(mockGetContentIndicators).not.toHaveBeenCalled();
      expect(mockExtractRecipeWithAI).not.toHaveBeenCalled();
    });

    it("names a page the Decision Model is sure is not a recipe with AI off too", async () => {
      mockCallRecipeScrapersParser.mockResolvedValue(notARecipe);
      mockIsAIEnabled.mockResolvedValue(false);
      mockIsRecipe.mockResolvedValue(false);

      const { parseRecipeFromUrl } = await import("@norish/api/parser");

      await expect(
        parseRecipeFromUrl("https://example.com/page", "recipe-1")
      ).rejects.toMatchObject({
        message: "This page doesn't look like a recipe.",
        detail: { aiFallback: "disabled" },
      });
      expect(mockIsRecipe).toHaveBeenCalledTimes(1);
    });

    it("asks whether the page is a recipe once, before extracting it", async () => {
      mockCallRecipeScrapersParser.mockResolvedValue(notARecipe);
      mockIsRecipe.mockResolvedValue(true);

      const { parseRecipeFromUrl } = await import("@norish/api/parser");

      await parseRecipeFromUrl("https://example.com/page", "recipe-1");

      expect(mockIsRecipe).toHaveBeenCalledTimes(1);
      expect(mockExtractRecipeWithAI).toHaveBeenCalled();
    });

    it("proceeds to extraction on a page the Decision Model does not refuse, whatever the keywords say", async () => {
      mockCallRecipeScrapersParser.mockResolvedValue(notARecipe);
      mockFetchRenderedPage.mockResolvedValue("<html><body>plain text</body></html>");
      mockIsRecipe.mockResolvedValue(true);

      const { parseRecipeFromUrl } = await import("@norish/api/parser");
      const result = await parseRecipeFromUrl("https://example.com/page", "recipe-1");

      expect(result).toMatchObject({ recipe: aiRecipe, usedAI: true });
      expect(mockGetContentIndicators).not.toHaveBeenCalled();
    });

    it("falls back to the keyword rule when triage has no opinion", async () => {
      mockCallRecipeScrapersParser.mockResolvedValue(notARecipe);
      mockFetchRenderedPage.mockResolvedValue("<html><body>plain text</body></html>");
      mockIsRecipe.mockResolvedValue(null);

      const { parseRecipeFromUrl } = await import("@norish/api/parser");

      await expect(parseRecipeFromUrl("https://example.com/page", "recipe-1")).rejects.toThrow(
        "Page does not appear to contain a recipe."
      );
      expect(mockGetContentIndicators).toHaveBeenCalled();
    });

    it("sends a structured parse the Decision Model scores as incomplete through AI extraction", async () => {
      mockIsParseComplete.mockResolvedValue(false);

      const { parseRecipeFromUrl } = await import("@norish/api/parser");
      const result = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1");

      expect(mockIsParseComplete).toHaveBeenCalledWith(structuredRecipe);
      expect(result).toMatchObject({ recipe: aiRecipe, usedAI: true });
    });

    it("keeps the incomplete flag when AI extraction brings no steps either", async () => {
      const stepless = { ...aiRecipe, steps: [] };

      mockIsParseComplete.mockResolvedValue(false);
      mockExtractRecipeWithAI.mockResolvedValue(stepless);

      const { parseRecipeFromUrl } = await import("@norish/api/parser");
      const result = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1");

      expect(result).toEqual({ recipe: stepless, usedAI: true, incomplete: true });
    });

    it("keeps a structured parse the Decision Model scores as complete", async () => {
      mockIsParseComplete.mockResolvedValue(true);

      const { parseRecipeFromUrl } = await import("@norish/api/parser");
      const result = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1");

      expect(result).toEqual({ recipe: structuredRecipe, usedAI: false });
      expect(mockExtractRecipeWithAI).not.toHaveBeenCalled();
    });

    it("keeps the incomplete parse, flagged, when AI extraction has nothing better", async () => {
      mockIsParseComplete.mockResolvedValue(false);
      mockExtractRecipeWithAI.mockRejectedValue(new Error("provider down"));

      const { parseRecipeFromUrl } = await import("@norish/api/parser");
      const result = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1");

      expect(result).toEqual({ recipe: structuredRecipe, usedAI: false, incomplete: true });
    });

    it("flags a parse scored as incomplete when AI is off, with nothing to re-extract it", async () => {
      mockIsAIEnabled.mockResolvedValue(false);
      mockIsParseComplete.mockResolvedValue(false);

      const { parseRecipeFromUrl } = await import("@norish/api/parser");
      const result = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1");

      expect(mockIsParseComplete).toHaveBeenCalledWith(structuredRecipe);
      expect(result).toEqual({ recipe: structuredRecipe, usedAI: false, incomplete: true });
      expect(mockExtractRecipeWithAI).not.toHaveBeenCalled();
    });

    it("does not flag a parse when AI is off and triage scores it complete or has no opinion", async () => {
      mockIsAIEnabled.mockResolvedValue(false);

      const { parseRecipeFromUrl } = await import("@norish/api/parser");

      for (const opinion of [true, null]) {
        mockIsParseComplete.mockResolvedValue(opinion);

        await expect(parseRecipeFromUrl("https://example.com/recipe", "recipe-1")).resolves.toEqual(
          { recipe: structuredRecipe, usedAI: false }
        );
      }
    });

    it("still forces extraction under alwaysUseAI, with no parse to score", async () => {
      mockShouldAlwaysUseAI.mockResolvedValue(true);

      const { parseRecipeFromUrl } = await import("@norish/api/parser");
      const result = await parseRecipeFromUrl("https://example.com/recipe", "recipe-1");

      expect(result).toMatchObject({ recipe: aiRecipe, usedAI: true });
      expect(mockCallRecipeScrapersParser).not.toHaveBeenCalled();
      expect(mockIsParseComplete).not.toHaveBeenCalled();
    });
  });
});
