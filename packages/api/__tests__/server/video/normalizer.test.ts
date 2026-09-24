// @vitest-environment node
/**
 * What the video extraction does around its one model request: ask under the
 * recipe-extraction prompt with the transcript as sections, refuse an empty
 * shell, and score its own output against the transcript in shadow before
 * normalising it — the same check a page gets.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({
  generateStructured: vi.fn(),
  shadowScore: vi.fn(),
  normalizeExtractionOutput: vi.fn(),
  downloadImage: vi.fn(),
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

vi.mock("@norish/shared-server/media/storage", () => ({
  downloadImage: mocked.downloadImage,
}));

const logger = vi.hoisted(() => {
  const silent = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn(), child: vi.fn() };

  silent.child.mockReturnValue(silent);

  return silent;
});

vi.mock("@norish/shared-server/logger", () => ({
  aiLogger: logger,
  videoLogger: logger,
  parserLogger: logger,
  serverLogger: logger,
  createLogger: () => logger,
}));

const { extractRecipeFromVideo } = await import("@norish/api/video/normalizer");
const { EXTRACTION_FAITHFULNESS_LEVELS } = await import("@norish/api/parser/recipe-extraction");

const EXTRACTED = {
  name: "Pesto pasta",
  description: null,
  notes: null,
  recipeYield: 2,
  prepTime: null,
  cookTime: null,
  totalTime: null,
  keywords: null,
  allergyIndications: [],
  categories: [],
  nutrition: { calories: null, fat: null, carbs: null, protein: null },
  recipeIngredient: { metric: ["200 g spaghetti"], us: ["7 oz spaghetti"] },
  recipeInstructions: { metric: ["Boil the pasta."], us: ["Boil the pasta."] },
};

const METADATA = {
  title: "Pesto reel",
  description: "Quick pesto.",
  duration: 47,
  thumbnail: "",
  videoStream: "present" as const,
};

const TRANSCRIPT = "first, boil the water\n\n---\n\nQuick pesto.";

beforeEach(() => {
  vi.clearAllMocks();
  mocked.generateStructured.mockResolvedValue(EXTRACTED);
  mocked.shadowScore.mockResolvedValue(2);
  mocked.normalizeExtractionOutput.mockResolvedValue({ id: "recipe-1", name: "Pesto pasta" });
});

describe("extractRecipeFromVideo", () => {
  it("scores its own output against the transcript in shadow, and nothing acts on the score", async () => {
    mocked.shadowScore.mockResolvedValue(0);

    const recipe = await extractRecipeFromVideo(
      TRANSCRIPT,
      METADATA,
      "recipe-1",
      "https://www.instagram.com/reel/ABC123/"
    );

    expect(mocked.shadowScore).toHaveBeenCalledWith({
      feature: "recipe-extraction",
      state: { source: TRANSCRIPT, extracted: EXTRACTED },
      instructions: expect.stringMatching(/faithful/i),
      criteria: EXTRACTION_FAITHFULNESS_LEVELS,
    });
    expect(recipe).toMatchObject({ id: "recipe-1", name: "Pesto pasta" });
  });

  it("refuses an empty shell before scoring or normalising anything", async () => {
    mocked.generateStructured.mockResolvedValue({
      ...EXTRACTED,
      recipeInstructions: { metric: [], us: [] },
    });

    await expect(
      extractRecipeFromVideo(TRANSCRIPT, METADATA, "recipe-1", "https://example.com/v")
    ).rejects.toThrow(/missing required fields/);
    expect(mocked.shadowScore).not.toHaveBeenCalled();
    expect(mocked.normalizeExtractionOutput).not.toHaveBeenCalled();
  });
});
