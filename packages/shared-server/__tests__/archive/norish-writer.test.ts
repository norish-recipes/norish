import { describe, expect, it } from "vitest";

import {
  NORISH_ARCHIVE_FORMAT,
  NORISH_ARCHIVE_FORMAT_VERSION,
} from "@norish/shared-server/archive/norish-format";
import { buildNorishArchive } from "@norish/shared-server/archive/norish-writer";

import { buildFullRecipe } from "./norish-fixtures";

// @vitest-environment node

async function readJson(zip: ReturnType<typeof buildNorishArchive>, path: string) {
  const file = zip.file(path);

  if (!file) throw new Error(`Missing archive entry: ${path}`);

  return JSON.parse(await file.async("string"));
}

describe("norish archive writer", () => {
  const exportedAt = new Date("2026-08-15T12:00:00Z");
  const exporter = { name: "Mika", origin: "https://norish.example.com" };

  it("writes a root manifest identifying the format", async () => {
    const zip = buildNorishArchive({
      records: [{ recipe: buildFullRecipe() }],
      exporter,
      exportedAt,
    });

    const manifest = await readJson(zip, "manifest.json");

    expect(manifest).toEqual({
      format: NORISH_ARCHIVE_FORMAT,
      formatVersion: NORISH_ARCHIVE_FORMAT_VERSION,
      exportedAt: "2026-08-15T12:00:00.000Z",
      exporter: { name: "Mika", origin: "https://norish.example.com" },
      recipeCount: 1,
    });
  });

  it("writes one folder per recipe keyed by its recipe id", async () => {
    const recipeA = buildFullRecipe();
    const recipeB = buildFullRecipe({
      id: "99999999-9999-4999-8999-999999999999",
      name: "Second Recipe",
    });

    const zip = buildNorishArchive({
      records: [{ recipe: recipeA }, { recipe: recipeB }],
      exporter,
      exportedAt,
    });

    expect(zip.file(`${recipeA.id}/recipe.json`)).toBeTruthy();
    expect(zip.file(`${recipeB.id}/recipe.json`)).toBeTruthy();

    const manifest = await readJson(zip, "manifest.json");

    expect(manifest.recipeCount).toBe(2);
  });

  it("carries cuisines as names, never instance-local ids", async () => {
    const zip = buildNorishArchive({
      records: [{ recipe: buildFullRecipe() }],
      exporter,
      exportedAt,
    });

    const recipeJson = await readJson(zip, "11111111-1111-4111-8111-111111111111/recipe.json");

    expect(recipeJson.cuisines).toEqual(["Italian", "Neapolitan"]);
  });

  it("carries the full canonical recipe data", async () => {
    const zip = buildNorishArchive({
      records: [{ recipe: buildFullRecipe() }],
      exporter,
      exportedAt,
    });

    const recipeJson = await readJson(zip, "11111111-1111-4111-8111-111111111111/recipe.json");

    expect(recipeJson).toMatchObject({
      name: "Spaghetti alle Vongole",
      description: "Clams and pasta",
      url: "https://example.com/vongole",
      notes: "Best with fresh clams",
      servings: 4,
      systemUsed: "metric",
      prepMinutes: 15,
      cookMinutes: 20,
      totalMinutes: 35,
      calories: 650,
      fat: "12.50",
      carbs: "80.00",
      protein: "25.00",
      originCountry: "IT",
      originCountryName: "Italia",
      originRegion: "Campania",
      provenanceNote: "A coastal classic",
      categories: ["Dinner"],
      tags: [{ name: "pasta" }, { name: "seafood" }],
    });
    expect(recipeJson.steps).toEqual([
      {
        step: "Boil the pasta",
        order: 0,
        systemUsed: "metric",
        images: [],
        stepIngredients: [{ ingredientOrder: 0, share: 1, order: 0 }],
      },
      {
        step: "Steam the clams",
        order: 1,
        systemUsed: "metric",
        images: [],
        stepIngredients: [{ ingredientOrder: 1, share: 0.5, order: 0 }],
      },
    ]);
  });

  it("nulls instance-local ingredient ids and travels ingredients by name", async () => {
    const zip = buildNorishArchive({
      records: [{ recipe: buildFullRecipe() }],
      exporter,
      exportedAt,
    });

    const recipeJson = await readJson(zip, "11111111-1111-4111-8111-111111111111/recipe.json");

    expect(recipeJson.recipeIngredients).toEqual([
      {
        ingredientId: null,
        ingredientName: "spaghetti",
        amount: 400,
        unit: "g",
        systemUsed: "metric",
        order: 0,
      },
      {
        ingredientId: null,
        ingredientName: "clams",
        amount: 1,
        unit: "kg",
        systemUsed: "metric",
        order: 1,
      },
    ]);
  });

  it("packs media into the recipe folder and rewrites references to relative paths", async () => {
    const { Readable } = await import("node:stream");
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

    const mediaBytes: Record<string, string> = {
      "images/hero.jpg": "hero-bytes",
      "images/gallery-1.jpg": "gallery-bytes",
      "steps/step-1.jpg": "step-bytes",
      "videos/video-1.mp4": "video-bytes",
      "videos/thumb-1.jpg": "thumb-bytes",
    };

    const { collectRecipeMediaRefs } = await import("@norish/shared-server/archive/norish-writer");
    const refs = collectRecipeMediaRefs(recipe);

    expect(refs).toEqual([
      {
        webPath: "/recipes/11111111-1111-4111-8111-111111111111/hero.jpg",
        archivePath: "images/hero.jpg",
      },
      {
        webPath: "/recipes/11111111-1111-4111-8111-111111111111/gallery-1.jpg",
        archivePath: "images/gallery-1.jpg",
      },
      {
        webPath: "/recipes/11111111-1111-4111-8111-111111111111/steps/step-1.jpg",
        archivePath: "steps/step-1.jpg",
      },
      {
        webPath: "/recipes/11111111-1111-4111-8111-111111111111/video-1.mp4",
        archivePath: "videos/video-1.mp4",
      },
      {
        webPath: "/recipes/11111111-1111-4111-8111-111111111111/thumb-1.jpg",
        archivePath: "videos/thumb-1.jpg",
      },
    ]);

    const zip = buildNorishArchive({
      records: [
        {
          recipe,
          media: refs.map((ref) => ({
            ...ref,
            source: () => Readable.from(Buffer.from(mediaBytes[ref.archivePath]!)),
          })),
        },
      ],
      exporter,
      exportedAt,
    });

    for (const [archivePath, bytes] of Object.entries(mediaBytes)) {
      const entry = zip.file(`${recipe.id}/${archivePath}`);

      expect(entry, archivePath).toBeTruthy();
      expect(await entry!.async("string")).toBe(bytes);
    }

    const recipeJson = await readJson(zip, `${recipe.id}/recipe.json`);

    expect(recipeJson.image).toBe("images/hero.jpg");
    expect(recipeJson.images).toEqual([{ image: "images/gallery-1.jpg", order: 0 }]);
    expect(recipeJson.steps[0].images).toEqual([{ image: "steps/step-1.jpg", order: 0 }]);
    expect(recipeJson.videos).toEqual([
      { video: "videos/video-1.mp4", thumbnail: "videos/thumb-1.jpg", duration: 42, order: 0 },
    ]);
  });

  it("keeps external media URLs unchanged and drops references without archive entries", async () => {
    const recipe = buildFullRecipe({
      image: "https://example.com/external-hero.jpg",
      images: [
        {
          id: "88888888-8888-4888-8888-888888888888",
          image: "/recipes/11111111-1111-4111-8111-111111111111/lost.jpg",
          order: 0,
          version: 1,
        },
      ],
    });

    // No media handles supplied: the local gallery file did not make it in
    const zip = buildNorishArchive({ records: [{ recipe }], exporter, exportedAt });

    const recipeJson = await readJson(zip, `${recipe.id}/recipe.json`);

    expect(recipeJson.image).toBe("https://example.com/external-hero.jpg");
    expect(recipeJson.images).toEqual([]);
  });

  it("exports a recipe with no media cleanly", async () => {
    const recipe = buildFullRecipe({ image: null, images: [], videos: [] });

    const zip = buildNorishArchive({ records: [{ recipe }], exporter, exportedAt });

    const recipeJson = await readJson(zip, `${recipe.id}/recipe.json`);

    expect(recipeJson.image).toBeNull();
    expect(recipeJson.images).toEqual([]);
    expect(recipeJson.videos).toEqual([]);
  });

  it("carries the author's display name, the exporter's rating, and the favourite mark", async () => {
    const zip = buildNorishArchive({
      records: [{ recipe: buildFullRecipe(), rating: 4, favorite: true }],
      exporter,
      exportedAt,
    });

    const recipeJson = await readJson(zip, "11111111-1111-4111-8111-111111111111/recipe.json");

    expect(recipeJson.authorName).toBe("Mika");
    expect(recipeJson.rating).toBe(4);
    expect(recipeJson.favorite).toBe(true);
  });

  it("omits marks the exporter never made", async () => {
    const zip = buildNorishArchive({
      records: [{ recipe: buildFullRecipe() }],
      exporter,
      exportedAt,
    });

    const recipeJson = await readJson(zip, "11111111-1111-4111-8111-111111111111/recipe.json");

    expect(recipeJson).not.toHaveProperty("rating");
    expect(recipeJson).not.toHaveProperty("favorite");
  });

  it("writes a null author name for an orphaned recipe", async () => {
    const zip = buildNorishArchive({
      records: [{ recipe: buildFullRecipe({ userId: null, author: undefined }) }],
      exporter,
      exportedAt,
    });

    const recipeJson = await readJson(zip, "11111111-1111-4111-8111-111111111111/recipe.json");

    expect(recipeJson.authorName).toBeNull();
  });

  it("leaks no account data of the author or exporter into a recipe entry", async () => {
    const zip = buildNorishArchive({
      records: [
        {
          recipe: buildFullRecipe({
            author: {
              id: "user-1",
              name: "Mika",
              image: "/avatars/user-1.jpg",
              version: 1,
            },
          }),
          rating: 4,
          favorite: true,
        },
      ],
      exporter,
      exportedAt,
    });

    const raw = await zip.file("11111111-1111-4111-8111-111111111111/recipe.json")!.async("string");

    expect(raw).toContain("Mika");
    expect(raw).not.toContain("user-1");
    expect(raw).not.toContain("avatars");
    expect(raw).not.toContain("@");

    const recipeJson = JSON.parse(raw);

    expect(recipeJson).not.toHaveProperty("author");
    expect(recipeJson).not.toHaveProperty("userId");
  });

  it("strips row ids, versions, and timestamps from the archive payload", async () => {
    const zip = buildNorishArchive({
      records: [{ recipe: buildFullRecipe() }],
      exporter,
      exportedAt,
    });

    const recipeJson = await readJson(zip, "11111111-1111-4111-8111-111111111111/recipe.json");

    expect(recipeJson).not.toHaveProperty("id");
    expect(recipeJson).not.toHaveProperty("userId");
    expect(recipeJson).not.toHaveProperty("version");
    expect(recipeJson).not.toHaveProperty("createdAt");
    expect(recipeJson).not.toHaveProperty("updatedAt");
    expect(recipeJson.tags[0]).not.toHaveProperty("version");
    expect(recipeJson.steps[0]).not.toHaveProperty("version");
    expect(recipeJson.recipeIngredients[0]).not.toHaveProperty("id");
    expect(recipeJson.recipeIngredients[0]).not.toHaveProperty("version");
  });
});
