/**
 * @vitest-environment node
 *
 * The visual briefer against the mocked AI Runtime — the single mocked AI
 * seam, as for every enrichment inferrer. What matters here is the outbound
 * request shape (the brief prompt with the recipe appended as sections,
 * never interpolated) and that an unusable brief fails rather than letting
 * an empty prompt reach the image model.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => ({ generateStructured: vi.fn() }));

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({
  generateStructured: mocked.generateStructured,
}));

vi.mock("@norish/shared-server/logger", () => ({
  aiLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { writeVisualBrief } = await import("@norish/shared-server/ai/enrichment/image-briefer");
const { AIDisabledError, AIResponseError } =
  await import("@norish/shared-server/ai/runtime/errors");

const RECIPE = {
  title: "Erwtensoep",
  description: "Dikke Hollandse snert.",
  ingredients: ["500 g spliterwten", "1 rookworst"],
};

beforeEach(() => {
  mocked.generateStructured.mockResolvedValue({ brief: "A thick green pea soup in a bowl." });
});

describe("writeVisualBrief", () => {
  it("asks the brief prompt with the recipe appended as sections", async () => {
    const brief = await writeVisualBrief(RECIPE);

    expect(brief).toBe("A thick green pea soup in a bowl.");
    expect(mocked.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "image-generation-brief" })
    );

    const request = mocked.generateStructured.mock.calls[0]![0] as { sections: string[] };
    const joined = request.sections.join("\n");

    expect(joined).toContain("Erwtensoep");
    expect(joined).toContain("Dikke Hollandse snert.");
    expect(joined).toContain("500 g spliterwten");
  });

  it("trims the brief and refuses a blank one", async () => {
    mocked.generateStructured.mockResolvedValue({ brief: "  padded  " });

    expect(await writeVisualBrief(RECIPE)).toBe("padded");

    mocked.generateStructured.mockResolvedValue({ brief: "   " });

    const failure = await writeVisualBrief(RECIPE).then(
      () => null,
      (error: unknown) => error
    );

    // Retryable: a model that answered blank once may answer next time.
    expect(failure).toBeInstanceOf(AIResponseError);
  });

  it("lets a runtime refusal pass through untouched", async () => {
    mocked.generateStructured.mockRejectedValue(new AIDisabledError());

    await expect(writeVisualBrief(RECIPE)).rejects.toBeInstanceOf(AIDisabledError);
  });
});
