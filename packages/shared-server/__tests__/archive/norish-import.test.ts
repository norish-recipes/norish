import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

// @vitest-environment node

const mockFindExistingRecipe = vi.fn();
const mockCreateRecipeWithRefs = vi.fn();
const mockUpdateRecipeWithRefs = vi.fn();
const mockDashboardRecipe = vi.fn();
const mockRateRecipe = vi.fn();
const mockAddFavorite = vi.fn();
const mockListCuisines = vi.fn();

vi.mock("node:fs/promises", () => ({
  default: {
    access: vi.fn().mockRejectedValue(new Error("missing")),
    mkdir: vi.fn(),
    cp: vi.fn(),
    rm: vi.fn(),
  },
}));

vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    UPLOADS_DIR: "/tmp/uploads",
  },
}));

vi.mock("@norish/db", () => ({
  findExistingRecipe: mockFindExistingRecipe,
  createRecipeWithRefs: mockCreateRecipeWithRefs,
  updateRecipeWithRefs: mockUpdateRecipeWithRefs,
  dashboardRecipe: mockDashboardRecipe,
}));

vi.mock("@norish/db/repositories/ratings", () => ({
  rateRecipe: mockRateRecipe,
}));

vi.mock("@norish/db/repositories/favorites", () => ({
  addFavorite: mockAddFavorite,
}));

vi.mock("@norish/db/repositories/cuisines", () => ({
  listCuisines: mockListCuisines,
}));

vi.mock("@norish/shared-server/media/storage", () => ({
  saveImageBytes: vi.fn().mockResolvedValue("/recipes/mock/image.jpg"),
  saveStepImageBytes: vi.fn().mockResolvedValue("/recipes/mock/steps/image.jpg"),
  saveVideoBytes: vi.fn().mockResolvedValue({ video: "/recipes/mock/video.mp4", duration: null }),
}));

// The other format parsers pull in the media/config stack at module load;
// they are inert for a Norish archive, so stub them out. The Norish parser
// itself stays real — it is what this suite exercises.
vi.mock("@norish/shared-server/archive/mela-parser", () => ({
  parseMelaArchive: vi.fn(),
  parseMelaRecipeToDTO: vi.fn(),
}));

vi.mock("@norish/shared-server/archive/mealie-parser", () => ({
  parseMealieArchive: vi.fn(),
  parseMealieRecipeToDTO: vi.fn(),
  extractMealieRecipeImage: vi.fn(),
  buildMealieLookups: vi.fn(),
}));

vi.mock("@norish/shared-server/archive/mealie-legacy-parser", () => ({
  detectMealieLegacyArchive: vi.fn().mockResolvedValue(0),
  extractMealieLegacyImage: vi.fn(),
  extractMealieLegacyRecipes: vi.fn(),
  parseMealieLegacyRecipeToDTO: vi.fn(),
}));

vi.mock("@norish/shared-server/archive/tandoor-parser", () => ({
  extractTandoorRecipes: vi.fn(),
  parseTandoorRecipeToDTO: vi.fn(),
}));

vi.mock("@norish/shared-server/archive/paprika-parser", () => ({
  extractPaprikaRecipes: vi.fn(),
  parsePaprikaRecipeToDTO: vi.fn(),
}));

const FOLDER_KEY = "11111111-1111-4111-8111-111111111111";
const FRENCH_CUISINE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function buildManifest(overrides: Record<string, unknown> = {}) {
  return {
    format: "norish-recipes",
    formatVersion: 1,
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
    servings: 2,
    systemUsed: "metric",
    categories: [],
    tags: [],
    cuisines: ["french", "Klingon"],
    recipeIngredients: [],
    steps: [],
    image: null,
    images: [],
    videos: [],
    rating: 4,
    favorite: true,
    authorName: "Somebody Else",
    ...overrides,
  };
}

async function buildArchiveBytes(
  recipes: Array<{ folderKey: string; json: string }>,
  manifest: Record<string, unknown> = buildManifest()
) {
  const zip = new JSZip();

  zip.file("manifest.json", JSON.stringify(manifest));
  for (const { folderKey, json } of recipes) {
    zip.file(`${folderKey}/recipe.json`, json);
  }

  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

describe("norish archive rides the shared import loop", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockListCuisines.mockResolvedValue([{ id: FRENCH_CUISINE_ID, name: "French", version: 1 }]);
    mockFindExistingRecipe.mockResolvedValue(null);
    mockCreateRecipeWithRefs.mockImplementation(async (recipeId) => ({
      status: "inserted",
      recipeId,
    }));
    mockDashboardRecipe.mockImplementation(async (recipeId) => ({
      id: recipeId,
      name: "Archived Soup",
    }));
  });

  it("detects the format and creates recipes with freshly minted ids", async () => {
    const zipBytes = await buildArchiveBytes([
      { folderKey: FOLDER_KEY, json: JSON.stringify(buildArchiveRecipeJson()) },
    ]);

    const { importArchive, getArchiveInfo, ArchiveFormat } =
      await import("@norish/shared-server/archive/parser");

    const info = await getArchiveInfo(await JSZip.loadAsync(zipBytes));

    expect(info).toEqual({ format: ArchiveFormat.NORISH, count: 1 });

    const result = await importArchive("user-1", ["user-1"], zipBytes);

    expect(result.imported).toHaveLength(1);
    expect(result.errors).toHaveLength(0);

    const [createdId, createdUserId, dto] = mockCreateRecipeWithRefs.mock.calls[0]!;

    expect(createdUserId).toBe("user-1");
    expect(createdId).toEqual(expect.any(String));
    expect(createdId).not.toBe(FOLDER_KEY);
    expect(dto).toMatchObject({
      id: createdId,
      name: "Archived Soup",
      cuisines: [FRENCH_CUISINE_ID],
    });
  });

  it("applies the archived rating and favourite to the created recipe", async () => {
    const zipBytes = await buildArchiveBytes([
      { folderKey: FOLDER_KEY, json: JSON.stringify(buildArchiveRecipeJson()) },
    ]);

    const { importArchive } = await import("@norish/shared-server/archive/parser");

    await importArchive("user-1", ["user-1"], zipBytes);

    const createdId = mockCreateRecipeWithRefs.mock.calls[0]![0];

    expect(mockRateRecipe).toHaveBeenCalledWith("user-1", createdId, 4);
    expect(mockAddFavorite).toHaveBeenCalledWith("user-1", createdId);
  });

  it("overwrites a matching recipe instead of duplicating it", async () => {
    mockFindExistingRecipe.mockResolvedValue("existing-recipe-id");
    mockDashboardRecipe.mockResolvedValue({ id: "existing-recipe-id", name: "Archived Soup" });

    const zipBytes = await buildArchiveBytes([
      { folderKey: FOLDER_KEY, json: JSON.stringify(buildArchiveRecipeJson()) },
    ]);

    const { importArchive } = await import("@norish/shared-server/archive/parser");
    const result = await importArchive("user-1", ["user-1"], zipBytes);

    expect(mockUpdateRecipeWithRefs).toHaveBeenCalledWith(
      "existing-recipe-id",
      "user-1",
      expect.objectContaining({ id: "existing-recipe-id", name: "Archived Soup" })
    );
    expect(mockCreateRecipeWithRefs).not.toHaveBeenCalled();
    expect(mockRateRecipe).toHaveBeenCalledWith("user-1", "existing-recipe-id", 4);
    expect(mockAddFavorite).toHaveBeenCalledWith("user-1", "existing-recipe-id");
    expect(result.imported).toHaveLength(1);
  });

  it("reports dropped cuisine names as a note on a recipe that imported", async () => {
    const zipBytes = await buildArchiveBytes([
      { folderKey: FOLDER_KEY, json: JSON.stringify(buildArchiveRecipeJson()) },
    ]);

    const { importArchive } = await import("@norish/shared-server/archive/parser");

    const progressNotes: Array<{ file: string; note: string }> = [];
    const result = await importArchive("user-1", ["user-1"], zipBytes, (_c, _r, _e, note) => {
      if (note) progressNotes.push(note);
    });

    expect(result.notes).toEqual([
      { file: "recipe_Archived Soup", note: "Unknown cuisines dropped: Klingon" },
    ]);
    expect(progressNotes).toEqual(result.notes);

    // The recipe itself landed — a dropped cuisine is a note about what it
    // lost, never a claim that the recipe was passed over.
    expect(result.imported).toHaveLength(1);
  });

  it("reports a failed entry as an error only, never also as a note", async () => {
    // The recipe drops cuisines (a note) and then fails to persist
    mockCreateRecipeWithRefs.mockRejectedValue(new Error("constraint violation"));

    const zipBytes = await buildArchiveBytes([
      { folderKey: FOLDER_KEY, json: JSON.stringify(buildArchiveRecipeJson()) },
    ]);

    const { importArchive } = await import("@norish/shared-server/archive/parser");
    const result = await importArchive("user-1", ["user-1"], zipBytes);

    expect(result.errors).toHaveLength(1);
    expect(result.notes).toHaveLength(0);
    expect(result.imported).toHaveLength(0);
  });

  it("isolates a corrupt recipe entry and imports the rest", async () => {
    const zipBytes = await buildArchiveBytes(
      [
        { folderKey: "aaaa-corrupt", json: "{ not json" },
        { folderKey: FOLDER_KEY, json: JSON.stringify(buildArchiveRecipeJson()) },
      ],
      buildManifest({ recipeCount: 2 })
    );

    const { importArchive } = await import("@norish/shared-server/archive/parser");
    const result = await importArchive("user-1", ["user-1"], zipBytes);

    expect(result.imported).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ file: "aaaa-corrupt/recipe.json" });
  });

  it("refuses an archive from a newer major format version", async () => {
    const zipBytes = await buildArchiveBytes(
      [{ folderKey: FOLDER_KEY, json: JSON.stringify(buildArchiveRecipeJson()) }],
      buildManifest({ formatVersion: 2 })
    );

    const { importArchive } = await import("@norish/shared-server/archive/parser");

    await expect(importArchive("user-1", ["user-1"], zipBytes)).rejects.toThrow(/format version 2/);
    expect(mockCreateRecipeWithRefs).not.toHaveBeenCalled();
  });

  it("refuses a newer major while the caller is still inspecting the archive", async () => {
    // The refusal has to land before an import is reported as started, or the
    // user meets it as a per-entry error inside a run that already looked
    // under way.
    const zipBytes = await buildArchiveBytes(
      [{ folderKey: FOLDER_KEY, json: JSON.stringify(buildArchiveRecipeJson()) }],
      buildManifest({ formatVersion: 2 })
    );
    const zip = await JSZip.loadAsync(new Uint8Array(zipBytes));

    const { getArchiveInfo } = await import("@norish/shared-server/archive/parser");

    await expect(getArchiveInfo(zip)).rejects.toThrow(/format version 2/);
  });
});
