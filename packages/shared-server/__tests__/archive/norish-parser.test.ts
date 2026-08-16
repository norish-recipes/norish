import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  NORISH_ARCHIVE_FORMAT,
  NORISH_ARCHIVE_FORMAT_VERSION,
} from "@norish/shared-server/archive/norish-format";

// @vitest-environment node

const mockSaveImageBytes = vi.fn();
const mockSaveStepImageBytes = vi.fn();
const mockSaveVideoBytes = vi.fn();

vi.mock("@norish/shared-server/media/storage", () => ({
  saveImageBytes: mockSaveImageBytes,
  saveStepImageBytes: mockSaveStepImageBytes,
  saveVideoBytes: mockSaveVideoBytes,
}));

const {
  assertSupportedNorishFormatVersion,
  countNorishRecipes,
  extractNorishRecipes,
  isNorishArchive,
  parseNorishRecipeToDTO,
  readNorishManifest,
} = await import("@norish/shared-server/archive/norish-parser");

const RECIPE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function buildManifest(overrides: Record<string, unknown> = {}) {
  return {
    format: NORISH_ARCHIVE_FORMAT,
    formatVersion: NORISH_ARCHIVE_FORMAT_VERSION,
    exportedAt: "2026-08-15T12:00:00.000Z",
    exporter: { name: "Mika", origin: "https://norish.example.com" },
    recipeCount: 1,
    ...overrides,
  };
}

function buildArchiveRecipeJson(overrides: Record<string, unknown> = {}) {
  return {
    name: "Archived Soup",
    description: "From another instance",
    url: "https://example.com/soup",
    notes: "Season well",
    servings: 2,
    systemUsed: "metric",
    prepMinutes: 10,
    cookMinutes: 30,
    totalMinutes: 40,
    calories: 300,
    fat: "10.00",
    carbs: "20.00",
    protein: "15.00",
    originCountry: "FR",
    originCountryName: "France",
    originRegion: null,
    provenanceNote: null,
    categories: ["Lunch"],
    tags: [{ name: "soup" }],
    cuisines: ["French"],
    recipeIngredients: [
      {
        ingredientId: null,
        ingredientName: "leek",
        amount: 2,
        unit: null,
        systemUsed: "metric",
        order: 0,
      },
    ],
    steps: [
      {
        step: "Simmer everything",
        order: 0,
        systemUsed: "metric",
        images: [],
        stepIngredients: [{ ingredientOrder: 0, share: 1, order: 0 }],
      },
    ],
    image: null,
    images: [],
    videos: [],
    ...overrides,
  };
}

const FRENCH_CUISINE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const cuisineLookup = new Map([["french", FRENCH_CUISINE_ID]]);

describe("norish archive detection", () => {
  it("positively identifies a Recipe Archive by its manifest", async () => {
    const zip = new JSZip();

    zip.file("manifest.json", JSON.stringify(buildManifest()));

    expect(await isNorishArchive(zip)).toBe(true);
  });

  it("rejects an archive without a manifest", async () => {
    const zip = new JSZip();

    zip.file("something.json", "{}");

    expect(await isNorishArchive(zip)).toBe(false);
  });

  it("rejects a manifest declaring another format", async () => {
    const zip = new JSZip();

    zip.file("manifest.json", JSON.stringify({ format: "someone-elses-recipes" }));

    expect(await isNorishArchive(zip)).toBe(false);
  });

  it("rejects a manifest that is not JSON", async () => {
    const zip = new JSZip();

    zip.file("manifest.json", "not json at all");

    expect(await isNorishArchive(zip)).toBe(false);
  });

  it("counts recipe folders, not the manifest's claim", () => {
    const zip = new JSZip();

    zip.file("manifest.json", JSON.stringify(buildManifest({ recipeCount: 99 })));
    zip.file("recipe-a/recipe.json", "{}");
    zip.file("recipe-b/recipe.json", "{}");
    zip.file("recipe-b/media/deep/recipe.json", "{}");

    expect(countNorishRecipes(zip)).toBe(2);
  });
});

describe("norish manifest reading", () => {
  it("returns the parsed manifest", async () => {
    const zip = new JSZip();

    zip.file("manifest.json", JSON.stringify(buildManifest()));

    const manifest = await readNorishManifest(zip);

    expect(manifest.format).toBe(NORISH_ARCHIVE_FORMAT);
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.exporter).toEqual({ name: "Mika", origin: "https://norish.example.com" });
    expect(manifest.recipeCount).toBe(1);
  });

  it("ignores unknown manifest fields within a major", async () => {
    const zip = new JSZip();

    zip.file(
      "manifest.json",
      JSON.stringify(buildManifest({ futureField: "from a later minor version" }))
    );

    await expect(readNorishManifest(zip)).resolves.toBeTruthy();
  });

  it("throws a clear error for a malformed manifest", async () => {
    const zip = new JSZip();

    zip.file("manifest.json", JSON.stringify({ format: NORISH_ARCHIVE_FORMAT }));

    await expect(readNorishManifest(zip)).rejects.toThrow(/Invalid Recipe Archive manifest/);
  });

  it("refuses a newer major format version with a clear error", () => {
    const manifest = {
      ...buildManifest({ formatVersion: NORISH_ARCHIVE_FORMAT_VERSION + 1 }),
      format: NORISH_ARCHIVE_FORMAT,
    } as Parameters<typeof assertSupportedNorishFormatVersion>[0];

    expect(() => assertSupportedNorishFormatVersion(manifest)).toThrow(
      /format version 2.*only understands up to version 1/s
    );
  });

  it("accepts the current format version", () => {
    const manifest = buildManifest() as Parameters<typeof assertSupportedNorishFormatVersion>[0];

    expect(() => assertSupportedNorishFormatVersion(manifest)).not.toThrow();
  });
});

describe("norish recipe extraction", () => {
  it("walks recipe folders and isolates corrupt entries", async () => {
    const zip = new JSZip();

    zip.file("manifest.json", JSON.stringify(buildManifest({ recipeCount: 2 })));
    zip.file("folder-a/recipe.json", JSON.stringify(buildArchiveRecipeJson()));
    zip.file("folder-b/recipe.json", "{ definitely not json");

    const entries = await extractNorishRecipes(zip);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ folderKey: "folder-a" });
    expect(entries[0]?.json).toBeTruthy();
    expect(entries[1]).toMatchObject({ folderKey: "folder-b" });
    expect(entries[1]?.parseError).toMatch(/Invalid recipe\.json/);
  });
});

describe("parseNorishRecipeToDTO", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSaveImageBytes.mockResolvedValue(`/recipes/${RECIPE_ID}/saved-image.jpg`);
    mockSaveStepImageBytes.mockResolvedValue(`/recipes/${RECIPE_ID}/steps/saved-step.jpg`);
    mockSaveVideoBytes.mockResolvedValue({
      video: `/recipes/${RECIPE_ID}/video-1.mp4`,
      duration: 42,
    });
  });

  it("yields the canonical insert shape with a freshly minted id", async () => {
    const { dto } = await parseNorishRecipeToDTO(buildArchiveRecipeJson(), RECIPE_ID, cuisineLookup);

    expect(dto).toMatchObject({
      id: RECIPE_ID,
      name: "Archived Soup",
      description: "From another instance",
      url: "https://example.com/soup",
      notes: "Season well",
      servings: 2,
      systemUsed: "metric",
      prepMinutes: 10,
      cookMinutes: 30,
      totalMinutes: 40,
      calories: 300,
      fat: "10.00",
      carbs: "20.00",
      protein: "15.00",
      originCountry: "FR",
      originCountryName: "France",
      categories: ["Lunch"],
      tags: [{ name: "soup" }],
      cuisines: [FRENCH_CUISINE_ID],
    });
    expect(dto.recipeIngredients).toEqual([
      expect.objectContaining({ ingredientName: "leek", amount: 2, order: 0 }),
    ]);
    expect(dto.steps).toEqual([
      expect.objectContaining({
        step: "Simmer everything",
        order: 0,
        stepIngredients: [{ ingredientOrder: 0, share: 1, order: 0 }],
      }),
    ]);
  });

  it("resolves cuisine names case-insensitively", async () => {
    const { dto, droppedCuisines } = await parseNorishRecipeToDTO(
      buildArchiveRecipeJson({ cuisines: ["FRENCH", " french "] }),
      RECIPE_ID,
      cuisineLookup
    );

    expect(dto.cuisines).toEqual([FRENCH_CUISINE_ID]);
    expect(droppedCuisines).toEqual([]);
  });

  it("drops unknown cuisines and reports them, never creating or demoting", async () => {
    const { dto, droppedCuisines } = await parseNorishRecipeToDTO(
      buildArchiveRecipeJson({ cuisines: ["French", "Klingon", "klingon"] }),
      RECIPE_ID,
      cuisineLookup
    );

    expect(dto.cuisines).toEqual([FRENCH_CUISINE_ID]);
    expect(droppedCuisines).toEqual(["Klingon"]);
    expect(dto.tags).toEqual([{ name: "soup" }]);
  });

  it("passes the exporter's rating and favourite through as import extras", async () => {
    const parsed = await parseNorishRecipeToDTO(
      buildArchiveRecipeJson({ rating: 5, favorite: true }),
      RECIPE_ID,
      cuisineLookup
    );

    expect(parsed.importedRating).toBe(5);
    expect(parsed.importedFavorite).toBe(true);
  });

  it("ignores attribution instead of importing it", async () => {
    const { dto } = await parseNorishRecipeToDTO(
      buildArchiveRecipeJson({ authorName: "Somebody Else" }),
      RECIPE_ID,
      cuisineLookup
    );

    expect(dto).not.toHaveProperty("authorName");
  });

  it("ignores unknown recipe fields within a major", async () => {
    const { dto } = await parseNorishRecipeToDTO(
      buildArchiveRecipeJson({ futureField: "additive evolution" }),
      RECIPE_ID,
      cuisineLookup
    );

    expect(dto.name).toBe("Archived Soup");
    expect(dto).not.toHaveProperty("futureField");
  });

  it("throws a clear error for an entry that fails the schema", async () => {
    await expect(
      parseNorishRecipeToDTO(buildArchiveRecipeJson({ name: 42 }), RECIPE_ID, cuisineLookup)
    ).rejects.toThrow(/Invalid recipe\.json/);
  });
});

describe("parseNorishRecipeToDTO media rehoming", () => {
  function buildMediaFolder() {
    const zip = new JSZip();

    zip.file("folder-a/recipe.json", "{}");
    zip.file("folder-a/images/hero.jpg", "hero-bytes");
    zip.file("folder-a/images/gallery-1.jpg", "gallery-bytes");
    zip.file("folder-a/steps/step-1.jpg", "step-bytes");
    zip.file("folder-a/videos/video-1.mp4", "video-bytes");
    zip.file("folder-a/videos/thumb-1.jpg", "thumb-bytes");

    return zip.folder("folder-a");
  }

  beforeEach(() => {
    vi.clearAllMocks();

    mockSaveImageBytes.mockResolvedValue(`/recipes/${RECIPE_ID}/saved-image.jpg`);
    mockSaveStepImageBytes.mockResolvedValue(`/recipes/${RECIPE_ID}/steps/saved-step.jpg`);
    mockSaveVideoBytes.mockResolvedValue({
      video: `/recipes/${RECIPE_ID}/video-1.mp4`,
      duration: 42,
    });
  });

  it("rehomes all media kinds through the media pipeline under the minted id", async () => {
    const { dto } = await parseNorishRecipeToDTO(
      buildArchiveRecipeJson({
        image: "images/hero.jpg",
        images: [{ image: "images/gallery-1.jpg", order: 0 }],
        steps: [
          {
            step: "Simmer everything",
            order: 0,
            systemUsed: "metric",
            images: [{ image: "steps/step-1.jpg", order: 0 }],
            stepIngredients: [],
          },
        ],
        videos: [
          { video: "videos/video-1.mp4", thumbnail: "videos/thumb-1.jpg", duration: 42, order: 0 },
        ],
      }),
      RECIPE_ID,
      cuisineLookup,
      buildMediaFolder()
    );

    expect(mockSaveImageBytes).toHaveBeenCalledWith(Buffer.from("hero-bytes"), RECIPE_ID);
    expect(mockSaveImageBytes).toHaveBeenCalledWith(Buffer.from("gallery-bytes"), RECIPE_ID);
    expect(mockSaveImageBytes).toHaveBeenCalledWith(Buffer.from("thumb-bytes"), RECIPE_ID);
    expect(mockSaveStepImageBytes).toHaveBeenCalledWith(Buffer.from("step-bytes"), RECIPE_ID);
    expect(mockSaveVideoBytes).toHaveBeenCalledWith(
      Buffer.from("video-bytes"),
      RECIPE_ID,
      ".mp4",
      42
    );

    expect(dto.image).toBe(`/recipes/${RECIPE_ID}/saved-image.jpg`);
    expect(dto.images).toEqual([{ image: `/recipes/${RECIPE_ID}/saved-image.jpg`, order: 0 }]);
    expect(dto.steps[0]?.images).toEqual([
      { image: `/recipes/${RECIPE_ID}/steps/saved-step.jpg`, order: 0 },
    ]);
    expect(dto.videos).toEqual([
      {
        video: `/recipes/${RECIPE_ID}/video-1.mp4`,
        thumbnail: `/recipes/${RECIPE_ID}/saved-image.jpg`,
        duration: 42,
        order: 0,
      },
    ]);
  });

  it("keeps external media URLs without touching the media pipeline", async () => {
    const { dto } = await parseNorishRecipeToDTO(
      buildArchiveRecipeJson({ image: "https://example.com/hero.jpg" }),
      RECIPE_ID,
      cuisineLookup,
      buildMediaFolder()
    );

    expect(dto.image).toBe("https://example.com/hero.jpg");
    expect(mockSaveImageBytes).not.toHaveBeenCalled();
  });

  it("drops references whose archive entry is missing", async () => {
    const { dto } = await parseNorishRecipeToDTO(
      buildArchiveRecipeJson({
        image: "images/not-there.jpg",
        images: [{ image: "images/also-not-there.jpg", order: 0 }],
      }),
      RECIPE_ID,
      cuisineLookup,
      buildMediaFolder()
    );

    expect(dto.image).toBeNull();
    expect(dto.images).toEqual([]);
  });

  it("refuses media paths outside the recipe folder's media subfolders", async () => {
    const zip = new JSZip();

    zip.file("folder-a/recipe.json", "{}");
    zip.file("secret.txt", "instance secret");

    const { dto } = await parseNorishRecipeToDTO(
      buildArchiveRecipeJson({ image: "../secret.txt" }),
      RECIPE_ID,
      cuisineLookup,
      zip.folder("folder-a")
    );

    expect(dto.image).toBeNull();
    expect(mockSaveImageBytes).not.toHaveBeenCalled();
  });

  it("never fails the recipe when a media save fails", async () => {
    mockSaveImageBytes.mockRejectedValue(new Error("disk full"));

    const { dto } = await parseNorishRecipeToDTO(
      buildArchiveRecipeJson({ image: "images/hero.jpg" }),
      RECIPE_ID,
      cuisineLookup,
      buildMediaFolder()
    );

    expect(dto.image).toBeNull();
    expect(dto.name).toBe("Archived Soup");
  });

  it("imports a recipe with no media cleanly", async () => {
    const { dto } = await parseNorishRecipeToDTO(
      buildArchiveRecipeJson(),
      RECIPE_ID,
      cuisineLookup,
      buildMediaFolder()
    );

    expect(dto.image).toBeNull();
    expect(dto.images).toEqual([]);
    expect(dto.videos).toEqual([]);
    expect(mockSaveImageBytes).not.toHaveBeenCalled();
    expect(mockSaveVideoBytes).not.toHaveBeenCalled();
  });
});
