// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@norish/config/env-config-server", () => ({
  INTERNAL_PARSER_API_URL: "http://127.0.0.1:8001",
  SERVER_CONFIG: {
    PARSER_API_TIMEOUT_MS: 3210,
  },
  buildInternalParserApiUrl: (pathname: string) =>
    new URL(pathname, "http://127.0.0.1:8001").toString(),
}));

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(),
};

vi.mock("@norish/shared-server/logger", () => ({
  parserLogger: mockLogger,
  redactUrl: (value: string) => value,
}));

describe("callRecipeScrapersParser", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends the url and html payload and parses a success response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          canonicalUrl: "https://example.com/recipe",
          parser: {
            mode: "supported",
            scraper: "AllRecipes",
            host: "allrecipes.com",
            siteName: "Allrecipes",
            version: "15.10.0",
          },
          recipe: {
            title: "Test recipe",
            ingredients: ["1 egg"],
            instructions_list: ["Cook it"],
          },
          media: {
            images: ["https://cdn.example.com/recipe.jpg"],
            videos: [],
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const { callRecipeScrapersParser } = await import("@norish/api/parser/python/client");
    const result = await callRecipeScrapersParser({
      url: "https://example.com/recipe",
      html: "<html><body>recipe</body></html>",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8001/parse",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "https://example.com/recipe",
          html: "<html><body>recipe</body></html>",
        }),
        signal: expect.any(AbortSignal),
      })
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parser.scraper).toBe("AllRecipes");
      expect(result.recipe.title).toBe("Test recipe");
    }
  });

  it.each([
    "WebsiteNotImplementedError",
    "NoSchemaFoundInWildMode",
    "RecipeSchemaNotFound",
  ] as const)("parses structured parser failure code %s", async (failureCode) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: false,
            error: failureCode,
            message: `failure: ${failureCode}`,
            parser: {
              mode: "supported",
              scraper: "unknown",
              version: "15.10.0",
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );

    const { callRecipeScrapersParser } = await import("@norish/api/parser/python/client");
    const result = await callRecipeScrapersParser({
      url: "https://example.com/recipe",
      html: "<html>recipe</html>",
    });

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: failureCode,
      })
    );
  });

  it("rejects an invalid parser response payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: true, recipe: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      )
    );

    const { callRecipeScrapersParser } = await import("@norish/api/parser/python/client");

    await expect(
      callRecipeScrapersParser({
        url: "https://example.com/recipe",
        html: "<html>recipe</html>",
      })
    ).rejects.toThrow("Recipe parser API returned an invalid payload");
  });
});
