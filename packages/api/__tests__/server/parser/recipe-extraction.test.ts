// @vitest-environment node
/**
 * What the AI extraction does around its one model request: sanitize the
 * source, ask under the recipe-extraction prompt, refuse an empty shell, and
 * score its own output against the source in shadow before normalising it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BUILT_IN_CATEGORIES } from "@norish/shared/lib/categories";

const mocked = vi.hoisted(() => ({
  generateStructured: vi.fn(),
  shadowScore: vi.fn(),
  normalizeExtractionOutput: vi.fn(),
  extractImageCandidates: vi.fn(),
  extractPageVideos: vi.fn(),
}));

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({
  generateStructured: mocked.generateStructured,
}));

vi.mock("@norish/shared-server/ai/enrichment/verification", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/ai/enrichment/verification")>()),
  shadowScore: mocked.shadowScore,
}));

vi.mock("@norish/api/parser/extraction-normalizer", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/api/parser/extraction-normalizer")>()),
  normalizeExtractionOutput: mocked.normalizeExtractionOutput,
}));

vi.mock("@norish/api/parser/parsers", () => ({
  extractImageCandidates: mocked.extractImageCandidates,
  extractPageVideos: mocked.extractPageVideos,
}));

const logger = vi.hoisted(() => {
  const silent = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() };

  silent.child.mockReturnValue(silent);

  return silent;
});

vi.mock("@norish/shared-server/logger", () => ({
  aiLogger: logger,
  parserLogger: logger,
  serverLogger: logger,
  createLogger: () => logger,
}));

const { extractRecipeWithAI, EXTRACTION_FAITHFULNESS_LEVELS } =
  await import("@norish/api/parser/recipe-extraction");

const EXTRACTED = {
  name: "Pesto pasta",
  description: null,
  sourceSystem: "metric",
  recipeIngredient: { metric: ["200 g spaghetti"], us: ["7 oz spaghetti"] },
  recipeInstructions: { metric: ["Boil the pasta."], us: ["Boil the pasta."] },
};

const HTML = "<html><body><main><h1>Pesto pasta</h1><p>200 g spaghetti</p></main></body></html>";

beforeEach(() => {
  mocked.generateStructured.mockResolvedValue(EXTRACTED);
  mocked.shadowScore.mockResolvedValue(2);
  mocked.extractImageCandidates.mockReturnValue([]);
  mocked.extractPageVideos.mockReturnValue([]);
  mocked.normalizeExtractionOutput.mockResolvedValue({ id: "recipe-1", name: "Pesto pasta" });
});

describe("extractRecipeWithAI", () => {
  it("asks under the recipe-extraction prompt with the sanitized page as a section", async () => {
    await extractRecipeWithAI(HTML, "recipe-1", {
      url: "https://example.com/pesto",
      householdCategories: BUILT_IN_CATEGORIES,
    });

    expect(mocked.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "recipe-extraction",
        sections: [
          "URL: https://example.com/pesto",
          "WEBPAGE TEXT:\nPesto pasta\n200 g spaghetti",
          "HOUSEHOLD CATEGORIES:\n- Breakfast\n- Lunch\n- Dinner\n- Snack",
        ],
      })
    );
  });

  it("offers the household's Categories as a section and holds the result to them", async () => {
    const household = ["Breakfast", "Lunch", "Dinner", "Snack", "Drinks"];

    await extractRecipeWithAI(HTML, "recipe-1", {
      url: "https://example.com/mojito",
      householdCategories: household,
    });

    expect(mocked.generateStructured.mock.calls[0]?.[0].sections).toContain(
      "HOUSEHOLD CATEGORIES:\n- Breakfast\n- Lunch\n- Dinner\n- Snack\n- Drinks"
    );
    expect(mocked.normalizeExtractionOutput.mock.calls[0]?.[1].householdCategories).toEqual(
      household
    );
  });

  describe("with JSON-LD", () => {
    const PAGE = `<html><body><main><h2>Pesto</h2><p>For the sauce:</p><p>Blend it all.</p><p>Comments</p></main></body></html>`;
    const RECIPE = {
      name: "Pesto",
      recipeInstructions: ["Blend it all."],
      review: [{ reviewBody: "Lovely" }],
      aggregateRating: { ratingValue: 5 },
    };

    const sections = () => mocked.generateStructured.mock.calls[0]?.[0].sections as string[];

    it("sends the JSON-LD first and the recipe's stretch of the page after it", async () => {
      await extractRecipeWithAI(PAGE, "recipe-1", {
        jsonLd: [RECIPE],
        householdCategories: BUILT_IN_CATEGORIES,
      });

      expect(sections()).toEqual([
        `JSON-LD (leads; use its values where present):\n${JSON.stringify(
          [{ name: "Pesto", recipeInstructions: ["Blend it all."] }],
          null,
          2
        )}`,
        "PAGE TEXT (fills what the JSON-LD lacks, including how the recipe is organised):\nPesto\nFor the sauce:\nBlend it all.",
        "HOUSEHOLD CATEGORIES:\n- Breakfast\n- Lunch\n- Dinner\n- Snack",
      ]);
      expect(mocked.shadowScore.mock.calls[0]?.[0].state.source).toContain("For the sauce:");
    });

    it("keeps JSON-LD holding HTML tags, which the page cleaning would have emptied", async () => {
      await extractRecipeWithAI(PAGE, "recipe-1", {
        jsonLd: [{ name: "Pesto", note: "<B>x</B>" }],
        householdCategories: BUILT_IN_CATEGORIES,
      });

      expect(sections()[0]).toContain("<B>x</B>");
    });

    it("sends the whole cleaned page when the page holds several recipes", async () => {
      await extractRecipeWithAI(PAGE, "recipe-1", {
        jsonLd: [RECIPE, { name: "Other" }],
        householdCategories: BUILT_IN_CATEGORIES,
      });

      expect(sections()[1]).toContain("Comments");
    });
  });

  describe("videos", () => {
    const LISTED = "https://videos.test/pesto.mp4";
    const savedVideos = () => mocked.normalizeExtractionOutput.mock.calls[0]?.[1].videos;

    beforeEach(() => {
      mocked.extractPageVideos.mockReturnValue([LISTED, "https://ads.test/frame"]);
    });

    it("lists the page's videos for the model, and saves what it picks", async () => {
      mocked.generateStructured.mockResolvedValue({ ...EXTRACTED, videoUrl: LISTED });

      await extractRecipeWithAI(HTML, "recipe-1", {
        url: "https://example.com/pesto",
        householdCategories: BUILT_IN_CATEGORIES,
      });

      expect(mocked.generateStructured.mock.calls[0]?.[0].sections).toContain(
        `VIDEOS ON THE PAGE:\n${LISTED}\nhttps://ads.test/frame`
      );
      expect(savedVideos()).toEqual([{ "@type": "VideoObject", contentUrl: LISTED }]);
    });

    it("never saves a URL the model picked from outside the page's list", async () => {
      mocked.generateStructured.mockResolvedValue({
        ...EXTRACTED,
        videoUrl: "http://169.254.169.254/latest",
      });

      await extractRecipeWithAI(HTML, "recipe-1", {
        url: "https://example.com/pesto",
        householdCategories: BUILT_IN_CATEGORIES,
      });

      expect(savedVideos()).toEqual([]);
    });

    it("takes JSON-LD's video as the main one, without asking the model", async () => {
      const video = { "@type": "VideoObject", contentUrl: "https://cdn.test/own.mp4" };

      mocked.generateStructured.mockResolvedValue({ ...EXTRACTED, videoUrl: LISTED });

      await extractRecipeWithAI(HTML, "recipe-1", {
        url: "https://example.com/pesto",
        jsonLd: [{ name: "Pesto", video }],
        householdCategories: BUILT_IN_CATEGORIES,
      });

      expect(mocked.extractPageVideos).not.toHaveBeenCalled();
      expect(savedVideos()).toEqual([video]);
    });

    it("looks for no videos without a page address", async () => {
      await extractRecipeWithAI("Pasted recipe text", "recipe-1", {
        householdCategories: BUILT_IN_CATEGORIES,
      });

      expect(mocked.extractPageVideos).not.toHaveBeenCalled();
    });
  });

  it("scores its own output against the source in shadow, and nothing acts on the score", async () => {
    mocked.shadowScore.mockResolvedValue(0);

    const recipe = await extractRecipeWithAI(HTML, "recipe-1", {
      url: "https://example.com/pesto",
      householdCategories: BUILT_IN_CATEGORIES,
    });

    expect(mocked.shadowScore).toHaveBeenCalledWith({
      feature: "recipe-extraction",
      state: { source: "Pesto pasta\n200 g spaghetti", extracted: EXTRACTED },
      instructions: expect.stringMatching(/faithful/i),
      criteria: EXTRACTION_FAITHFULNESS_LEVELS,
    });
    expect(EXTRACTION_FAITHFULNESS_LEVELS).toHaveLength(3);
    expect(recipe).toEqual({ id: "recipe-1", name: "Pesto pasta" });
  });

  it("refuses an empty shell before scoring or normalising anything", async () => {
    mocked.generateStructured.mockResolvedValue({
      ...EXTRACTED,
      sourceSystem: "metric",
      recipeIngredient: { metric: [], us: [] },
      recipeInstructions: { metric: [], us: [] },
    });

    await expect(
      extractRecipeWithAI(HTML, "recipe-1", { householdCategories: BUILT_IN_CATEGORIES })
    ).rejects.toThrow(/missing required fields/);
    expect(mocked.shadowScore).not.toHaveBeenCalled();
    expect(mocked.normalizeExtractionOutput).not.toHaveBeenCalled();
  });

  it("keeps a recipe that states no steps (#646)", async () => {
    const stepless = { ...EXTRACTED, recipeInstructions: { metric: [], us: [] } };

    mocked.generateStructured.mockResolvedValue(stepless);

    await expect(
      extractRecipeWithAI(HTML, "recipe-1", { householdCategories: BUILT_IN_CATEGORIES })
    ).resolves.toMatchObject({ id: "recipe-1" });
    expect(mocked.normalizeExtractionOutput).toHaveBeenCalledWith(stepless, expect.anything());
  });
});
