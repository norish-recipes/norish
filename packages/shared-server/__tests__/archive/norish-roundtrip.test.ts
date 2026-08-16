import { Readable } from "node:stream";
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FullRecipeInsertSchema } from "@norish/shared/contracts/zod";

import { buildFullRecipe } from "./norish-fixtures";

// @vitest-environment node

const mockSaveImageBytes = vi.fn();
const mockSaveStepImageBytes = vi.fn();
const mockSaveVideoBytes = vi.fn();

vi.mock("@norish/shared-server/media/storage", () => ({
  saveImageBytes: mockSaveImageBytes,
  saveStepImageBytes: mockSaveStepImageBytes,
  saveVideoBytes: mockSaveVideoBytes,
}));

const { extractNorishRecipes, parseNorishRecipeToDTO, readNorishManifest } =
  await import("@norish/shared-server/archive/norish-parser");
const { buildNorishArchive, collectRecipeMediaRefs } =
  await import("@norish/shared-server/archive/norish-writer");

/**
 * The centerpiece: records → writer → zip bytes → parser → insert shapes.
 * Asserts losslessness plus the deliberate losses — unmatched cuisines
 * dropped, ids re-minted, ownership flattened to the importer (ownership
 * itself is loop semantics; here it shows as no owner data in the shape).
 */
describe("norish archive round-trip", () => {
  const MINTED_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const ITALIAN_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

  beforeEach(() => {
    vi.clearAllMocks();

    mockSaveImageBytes.mockResolvedValue(`/recipes/${MINTED_ID}/saved-image.jpg`);
    mockSaveStepImageBytes.mockResolvedValue(`/recipes/${MINTED_ID}/steps/saved-step.jpg`);
    mockSaveVideoBytes.mockResolvedValue({
      video: `/recipes/${MINTED_ID}/video-1.mp4`,
      duration: 42,
    });
  });

  async function roundTrip(
    recipe = buildFullRecipe(),
    mediaBytes: Record<string, string> = {},
    marks: { rating?: number; favorite?: boolean } = {}
  ) {
    const zip = buildNorishArchive({
      records: [
        {
          recipe,
          media: collectRecipeMediaRefs(recipe)
            .filter((ref) => mediaBytes[ref.archivePath] !== undefined)
            .map((ref) => ({
              ...ref,
              source: () => Readable.from(Buffer.from(mediaBytes[ref.archivePath]!)),
            })),
          ...marks,
        },
      ],
      exporter: { name: "Mika", origin: "https://norish.example.com" },
      exportedAt: new Date("2026-08-15T12:00:00Z"),
    });

    // Serialize to real bytes and reload, exactly like an import would
    const bytes = await zip.generateAsync({ type: "uint8array" });
    const reloaded = await JSZip.loadAsync(bytes);

    const manifest = await readNorishManifest(reloaded);
    const entries = await extractNorishRecipes(reloaded);

    expect(entries).toHaveLength(1);

    const entry = entries[0]!;

    expect(entry.parseError).toBeUndefined();

    // The target instance only knows "Italian" — "Neapolitan" must drop
    const parsed = await parseNorishRecipeToDTO(
      entry.json,
      MINTED_ID,
      new Map([["italian", ITALIAN_ID]]),
      reloaded.folder(entry.folderKey)
    );

    return { manifest, entry, parsed };
  }

  it("survives the writer → bytes → parser trip losslessly", async () => {
    const recipe = buildFullRecipe();
    const { parsed } = await roundTrip(recipe);
    const dto = parsed.dto;

    expect(dto.name).toBe(recipe.name);
    expect(dto.description).toBe(recipe.description);
    expect(dto.url).toBe(recipe.url);
    expect(dto.notes).toBe(recipe.notes);
    expect(dto.servings).toBe(recipe.servings);
    expect(dto.systemUsed).toBe(recipe.systemUsed);
    expect(dto.prepMinutes).toBe(recipe.prepMinutes);
    expect(dto.cookMinutes).toBe(recipe.cookMinutes);
    expect(dto.totalMinutes).toBe(recipe.totalMinutes);
    expect(dto.calories).toBe(recipe.calories);
    expect(dto.fat).toBe(recipe.fat);
    expect(dto.carbs).toBe(recipe.carbs);
    expect(dto.protein).toBe(recipe.protein);
    expect(dto.originCountry).toBe(recipe.originCountry);
    expect(dto.originCountryName).toBe(recipe.originCountryName);
    expect(dto.originRegion).toBe(recipe.originRegion);
    expect(dto.provenanceNote).toBe(recipe.provenanceNote);
    expect(dto.categories).toEqual(recipe.categories);
    expect(dto.tags).toEqual([{ name: "pasta" }, { name: "seafood" }]);
    expect(dto.recipeIngredients).toEqual([
      expect.objectContaining({
        ingredientId: null,
        ingredientName: "spaghetti",
        amount: 400,
        unit: "g",
        systemUsed: "metric",
        order: 0,
      }),
      expect.objectContaining({
        ingredientId: null,
        ingredientName: "clams",
        amount: 1,
        unit: "kg",
        systemUsed: "metric",
        order: 1,
      }),
    ]);
    expect(dto.steps).toEqual([
      expect.objectContaining({
        step: "Boil the pasta",
        order: 0,
        systemUsed: "metric",
        stepIngredients: [{ ingredientOrder: 0, share: 1, order: 0 }],
      }),
      expect.objectContaining({
        step: "Steam the clams",
        order: 1,
        systemUsed: "metric",
        stepIngredients: [{ ingredientOrder: 1, share: 0.5, order: 0 }],
      }),
    ]);
  });

  it("produces a shape the canonical insert contract accepts", async () => {
    const { parsed } = await roundTrip();

    const validated = FullRecipeInsertSchema.safeParse(parsed.dto);

    expect(validated.success).toBe(true);
  });

  it("re-mints ids: the archive folder key is never reused", async () => {
    const recipe = buildFullRecipe();
    const { entry, parsed } = await roundTrip(recipe);

    expect(entry.folderKey).toBe(recipe.id);
    expect(parsed.dto.id).toBe(MINTED_ID);
    expect(parsed.dto.id).not.toBe(recipe.id);
  });

  it("drops cuisines the target vocabulary does not know and keeps the rest", async () => {
    const { parsed } = await roundTrip();

    expect(parsed.dto.cuisines).toEqual([ITALIAN_ID]);
    expect(parsed.droppedCuisines).toEqual(["Neapolitan"]);
  });

  it("carries a recipe's media through the archive and back onto the new recipe", async () => {
    const recipe = buildFullRecipe({
      images: [
        {
          id: "88888888-8888-4888-8888-888888888888",
          image: "/recipes/11111111-1111-4111-8111-111111111111/gallery-1.jpg",
          order: 0,
          version: 1,
        },
      ],
      steps: [
        {
          step: "Boil the pasta",
          systemUsed: "metric",
          order: 0,
          version: 1,
          images: [
            {
              id: "aaaaaaa1-8888-4888-8888-888888888888",
              image: "/recipes/11111111-1111-4111-8111-111111111111/steps/step-1.jpg",
              order: 0,
              version: 1,
            },
          ],
          stepIngredients: [],
        },
      ],
      videos: [
        {
          id: "aaaaaaa2-8888-4888-8888-888888888888",
          video: "/recipes/11111111-1111-4111-8111-111111111111/video-1.mp4",
          thumbnail: "/recipes/11111111-1111-4111-8111-111111111111/thumb-1.jpg",
          duration: 42,
          order: 0,
          version: 1,
        },
      ],
    });

    const { parsed } = await roundTrip(recipe, {
      "images/hero.jpg": "hero-bytes",
      "images/gallery-1.jpg": "gallery-bytes",
      "steps/step-1.jpg": "step-bytes",
      "videos/video-1.mp4": "video-bytes",
      "videos/thumb-1.jpg": "thumb-bytes",
    });

    // The exact bytes written on export are what the importer re-saves
    expect(mockSaveImageBytes).toHaveBeenCalledWith(Buffer.from("hero-bytes"), MINTED_ID);
    expect(mockSaveImageBytes).toHaveBeenCalledWith(Buffer.from("gallery-bytes"), MINTED_ID);
    expect(mockSaveStepImageBytes).toHaveBeenCalledWith(Buffer.from("step-bytes"), MINTED_ID);
    expect(mockSaveVideoBytes).toHaveBeenCalledWith(
      Buffer.from("video-bytes"),
      MINTED_ID,
      ".mp4",
      42
    );

    // and the recreated recipe points at the new instance's own paths
    expect(parsed.dto.image).toBe(`/recipes/${MINTED_ID}/saved-image.jpg`);
    expect(parsed.dto.images).toHaveLength(1);
    expect(parsed.dto.steps[0]?.images).toHaveLength(1);
    expect(parsed.dto.videos).toEqual([
      {
        video: `/recipes/${MINTED_ID}/video-1.mp4`,
        thumbnail: `/recipes/${MINTED_ID}/saved-image.jpg`,
        duration: 42,
        order: 0,
      },
    ]);
  });

  it("round-trips a recipe with no media at all", async () => {
    const { parsed } = await roundTrip(buildFullRecipe({ image: null, images: [], videos: [] }));

    expect(parsed.dto.image).toBeNull();
    expect(parsed.dto.images).toEqual([]);
    expect(parsed.dto.videos).toEqual([]);
    expect(mockSaveImageBytes).not.toHaveBeenCalled();
    expect(FullRecipeInsertSchema.safeParse(parsed.dto).success).toBe(true);
  });

  it("carries the exporter's marks through as import extras for the importing user", async () => {
    const { parsed } = await roundTrip(buildFullRecipe(), {}, { rating: 5, favorite: true });

    expect(parsed.importedRating).toBe(5);
    expect(parsed.importedFavorite).toBe(true);
  });

  it("survives a recipe the exporter never marked", async () => {
    const { parsed } = await roundTrip();

    expect(parsed.importedRating).toBeUndefined();
    expect(parsed.importedFavorite).toBeUndefined();
  });

  it("keeps attribution out of the imported recipe", async () => {
    const recipe = buildFullRecipe();
    const { entry, parsed } = await roundTrip(recipe);

    // The archive carries the display name...
    expect((entry.json as { authorName?: string }).authorName).toBe("Mika");
    // ...and the importer ignores it: ownership belongs to whoever imports
    expect(parsed.dto).not.toHaveProperty("authorName");
    expect(parsed.dto).not.toHaveProperty("author");
  });

  it("imports fine when the archive carries no author name at all", async () => {
    const { parsed } = await roundTrip(buildFullRecipe({ userId: null, author: undefined }));

    expect(parsed.dto.name).toBe("Spaghetti alle Vongole");
    expect(FullRecipeInsertSchema.safeParse(parsed.dto).success).toBe(true);
  });

  it("flattens ownership: no account data of the exporter or author survives", async () => {
    const { manifest, parsed } = await roundTrip();

    // Manifest attribution is a display name and origin, nothing more
    expect(manifest.exporter).toEqual({ name: "Mika", origin: "https://norish.example.com" });

    const dtoJson = JSON.stringify(parsed.dto);

    expect(dtoJson).not.toContain("user-1");
    expect(dtoJson).not.toContain("avatars");
    expect(parsed.dto).not.toHaveProperty("userId");
    expect(parsed.dto).not.toHaveProperty("author");
    expect(parsed.dto).not.toHaveProperty("authorName");
  });
});
