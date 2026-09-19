// @vitest-environment node
/**
 * What the AI extraction does around its one model request: sanitize the
 * source, ask under the recipe-extraction prompt, refuse an empty shell, and
 * score its own output against the source in shadow before normalising it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  generateStructured: vi.fn(),
  shadowScore: vi.fn(),
  normalizeExtractionOutput: vi.fn(),
  extractImageCandidates: vi.fn(),
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
  recipeIngredient: { metric: ["200 g spaghetti"], us: ["7 oz spaghetti"] },
  recipeInstructions: { metric: ["Boil the pasta."], us: ["Boil the pasta."] },
};

const HTML = "<html><body><main><h1>Pesto pasta</h1><p>200 g spaghetti</p></main></body></html>";

beforeEach(() => {
  vi.clearAllMocks();
  mocked.generateStructured.mockResolvedValue(EXTRACTED);
  mocked.shadowScore.mockResolvedValue(2);
  mocked.extractImageCandidates.mockReturnValue([]);
  mocked.normalizeExtractionOutput.mockResolvedValue({ id: "recipe-1", name: "Pesto pasta" });
});

describe("extractRecipeWithAI", () => {
  it("asks under the recipe-extraction prompt with the sanitized page as a section", async () => {
    await extractRecipeWithAI(HTML, "recipe-1", "https://example.com/pesto");

    expect(mocked.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "recipe-extraction",
        sections: ["URL: https://example.com/pesto", "WEBPAGE TEXT:\nPesto pasta\n200 g spaghetti"],
      })
    );
  });

  it("scores its own output against the source in shadow, and nothing acts on the score", async () => {
    mocked.shadowScore.mockResolvedValue(0);

    const recipe = await extractRecipeWithAI(HTML, "recipe-1", "https://example.com/pesto");

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
      recipeInstructions: { metric: [], us: [] },
    });

    await expect(extractRecipeWithAI(HTML, "recipe-1")).rejects.toThrow(/missing required fields/);
    expect(mocked.shadowScore).not.toHaveBeenCalled();
    expect(mocked.normalizeExtractionOutput).not.toHaveBeenCalled();
  });
});
