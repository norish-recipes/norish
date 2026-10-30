// @vitest-environment node
import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";

import { archiveRouter } from "@norish/trpc/routers/archive/archive";

import { archive } from "../mocks/realtime/archive";
import { cookbooks } from "../mocks/realtime/cookbooks";
import { recipes } from "../mocks/realtime/recipes";

const mockArchiveParser = vi.hoisted(() => ({
  importArchive: vi.fn().mockResolvedValue({ imported: [], errors: [], notes: [] }),
  calculateBatchSize: vi.fn(() => 10),
  getArchiveInfo: vi.fn().mockResolvedValue({ format: "paprika", count: 1 }),
  ArchiveFormat: {
    NORISH: "norish",
    MELA: "mela",
    MEALIE: "mealie",
    TANDOOR: "tandoor",
    PAPRIKA: "paprika",
    UNKNOWN: "unknown",
  },
}));

vi.mock("@norish/shared-server/archive/parser", () => mockArchiveParser);

const mockAnnounceUsableRecipe = vi.hoisted(() => vi.fn());

vi.mock("@norish/queue/enrichment/announce", () => ({
  announceUsableRecipe: mockAnnounceUsableRecipe,
}));

vi.mock("@norish/shared-server/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/shared-server/logger")>();

  return {
    ...actual,
    trpcLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock("@norish/shared-server/cache/household", () => ({
  getCachedHouseholdForUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@norish/shared-server/realtime/recipes", () => import("../mocks/realtime/recipes"));
vi.mock("@norish/shared-server/realtime/archive", () => import("../mocks/realtime/archive"));
vi.mock("@norish/shared-server/realtime/cookbooks", () => import("../mocks/realtime/cookbooks"));
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getRecipePermissionPolicy: vi.fn().mockResolvedValue({ view: "everyone" }),
}));

describe("archiveRouter.importArchive", () => {
  it("accepts .paprikarecipes files", async () => {
    const caller = archiveRouter.createCaller({
      user: {
        id: "user-1",
      },
      userIds: ["user-1"],
      householdKey: "house-1",
    } as any);

    const formData = new FormData();
    const zip = new JSZip();

    zip.file("recipe.paprikarecipe", "dummy");
    const zipBuffer = await zip.generateAsync({ type: "uint8array" });
    const zipArrayBuffer = zipBuffer.buffer.slice(
      zipBuffer.byteOffset,
      zipBuffer.byteOffset + zipBuffer.byteLength
    ) as ArrayBuffer;

    const file = new File([zipArrayBuffer], "recipes.paprikarecipes", {
      type: "application/zip",
    });

    formData.append("file", file);

    const result = await caller.importArchive(formData);

    expect(result.success).toBe(true);
    expect(result.total).toBe(1);
  });

  it("accepts .norishrecipes files", async () => {
    mockArchiveParser.getArchiveInfo.mockResolvedValue({ format: "norish", count: 2 });

    const caller = archiveRouter.createCaller({
      user: {
        id: "user-1",
      },
      userIds: ["user-1"],
      householdKey: "house-1",
    } as any);

    const formData = new FormData();
    const zip = new JSZip();

    zip.file("manifest.json", JSON.stringify({ format: "norish-recipes", formatVersion: 1 }));
    const zipBuffer = await zip.generateAsync({ type: "uint8array" });
    const zipArrayBuffer = zipBuffer.buffer.slice(
      zipBuffer.byteOffset,
      zipBuffer.byteOffset + zipBuffer.byteLength
    ) as ArrayBuffer;

    const file = new File([zipArrayBuffer], "norish-recipes-2026-08-15.norishrecipes", {
      type: "application/zip",
    });

    formData.append("file", file);

    const result = await caller.importArchive(formData);

    expect(result.success).toBe(true);
    expect(result.total).toBe(2);
  });

  it("rejects unsupported file extensions", async () => {
    const caller = archiveRouter.createCaller({
      user: {
        id: "user-1",
      },
      userIds: ["user-1"],
      householdKey: "house-1",
    } as any);

    const formData = new FormData();
    const file = new File([new ArrayBuffer(4)], "recipes.tar.gz", {
      type: "application/gzip",
    });

    formData.append("file", file);

    const result = await caller.importArchive(formData);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/\.norishrecipes/);
  });

  it("announces archive-created recipes by the view policy, like every other recipe create", async () => {
    const recipe = { id: "recipe-1", name: "Imported" };

    mockArchiveParser.getArchiveInfo.mockResolvedValue({ format: "paprika", count: 1 });
    mockArchiveParser.importArchive.mockImplementation(
      async (
        _userId: string,
        _userIds: string[],
        _buffer: Buffer,
        onProgress: (current: number, recipe?: unknown) => void
      ) => {
        onProgress(1, recipe);

        return { imported: [recipe], errors: [], notes: [] };
      }
    );

    const caller = archiveRouter.createCaller({
      user: { id: "user-1" },
      userIds: ["user-1"],
      householdKey: "house-1",
    } as any);

    const formData = new FormData();
    const zip = new JSZip();

    zip.file("recipe.paprikarecipe", "dummy");
    const zipBuffer = await zip.generateAsync({ type: "uint8array" });
    const zipArrayBuffer = zipBuffer.buffer.slice(
      zipBuffer.byteOffset,
      zipBuffer.byteOffset + zipBuffer.byteLength
    ) as ArrayBuffer;

    formData.append(
      "file",
      new File([zipArrayBuffer], "recipes.paprikarecipes", { type: "application/zip" })
    );

    const result = await caller.importArchive(formData);

    expect(result.success).toBe(true);

    // The import runs detached from the mutation; let it settle.
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));

    expect(recipes.publish).toHaveBeenCalledWith(
      "recipeBatchCreated",
      { recipes: [recipe] },
      { viewPolicy: "everyone", userId: "user-1", householdKey: "user-1" }
    );
    expect(recipes.publish).not.toHaveBeenCalledWith("recipeBatchCreated", expect.anything(), {
      householdKey: "user-1",
    });
    expect(archive.publish).toHaveBeenCalledWith(
      "archiveProgress",
      expect.objectContaining({ current: 1, total: 1, imported: 1 }),
      { userId: "user-1" }
    );
    expect(archive.publish).toHaveBeenCalledWith(
      "archiveCompleted",
      expect.objectContaining({ imported: 1 }),
      { userId: "user-1" }
    );
  });
  it("announces each recipe the import inserted for automatic enrichment", async () => {
    const inserted = { status: "inserted", recipeId: "recipe-new" };

    mockArchiveParser.getArchiveInfo.mockResolvedValue({ format: "paprika", count: 2 });
    mockArchiveParser.importArchive.mockImplementation(
      async (
        _userId: string,
        _userIds: string[],
        _buffer: Buffer,
        onProgress: (...args: unknown[]) => void
      ) => {
        onProgress(1, { id: "recipe-overwritten" });
        onProgress(2, { id: "recipe-new" }, undefined, undefined, { inserted, cookbooks: [] });

        return { imported: [], errors: [], notes: [] };
      }
    );
    mockAnnounceUsableRecipe.mockResolvedValue(undefined);

    const caller = archiveRouter.createCaller({
      user: { id: "user-1" },
      userIds: ["user-1"],
      householdKey: "house-1",
    } as any);

    const formData = new FormData();
    const zip = new JSZip();

    zip.file("recipe.paprikarecipe", "dummy");
    const zipBuffer = await zip.generateAsync({ type: "uint8array" });
    const zipArrayBuffer = zipBuffer.buffer.slice(
      zipBuffer.byteOffset,
      zipBuffer.byteOffset + zipBuffer.byteLength
    ) as ArrayBuffer;

    formData.append(
      "file",
      new File([zipArrayBuffer], "recipes.paprikarecipes", { type: "application/zip" })
    );

    await caller.importArchive(formData);

    // The import runs detached from the mutation; let it settle.
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));

    // Only what the loop inserted: the overwritten recipe is not announced again.
    expect(mockAnnounceUsableRecipe).toHaveBeenCalledTimes(1);
    expect(mockAnnounceUsableRecipe).toHaveBeenCalledWith(inserted, {
      userId: "user-1",
      householdKey: "user-1",
      householdUserIds: null,
    });
  });
  it("tells the household about the cookbooks the import made and filed into", async () => {
    const made = { id: "cookbook-natale", title: "Natale" };

    mockArchiveParser.getArchiveInfo.mockResolvedValue({ format: "recipe-keeper", count: 2 });
    mockArchiveParser.importArchive.mockImplementation(
      async (
        _userId: string,
        _userIds: string[],
        _buffer: Buffer,
        onProgress: (...args: unknown[]) => void
      ) => {
        onProgress(1, { id: "recipe-1" }, undefined, undefined, {
          cookbooks: [{ cookbookId: made.id, created: made }],
        });
        onProgress(2, { id: "recipe-2" }, undefined, undefined, {
          cookbooks: [{ cookbookId: made.id }],
        });

        return { imported: [], errors: [], notes: [] };
      }
    );

    const caller = archiveRouter.createCaller({
      user: { id: "user-1" },
      userIds: ["user-1"],
      householdKey: "house-1",
    } as any);

    const formData = new FormData();
    const zip = new JSZip();

    zip.file("recipes.html", "dummy");
    const zipBuffer = await zip.generateAsync({ type: "uint8array" });
    const zipArrayBuffer = zipBuffer.buffer.slice(
      zipBuffer.byteOffset,
      zipBuffer.byteOffset + zipBuffer.byteLength
    ) as ArrayBuffer;

    formData.append("file", new File([zipArrayBuffer], "RecipeKeeper_20260322_174041.zip"));

    await caller.importArchive(formData);

    // The import runs detached from the mutation; let it settle.
    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));

    const target = { viewPolicy: "everyone", userId: "user-1", householdKey: "user-1" };

    expect(cookbooks.publish).toHaveBeenCalledTimes(3);
    expect(cookbooks.publish).toHaveBeenCalledWith("created", { cookbook: made }, target);
    expect(cookbooks.publish).toHaveBeenCalledWith(
      "membershipChanged",
      { cookbookId: made.id, recipeId: "recipe-1", isMember: true },
      target
    );
    expect(cookbooks.publish).toHaveBeenCalledWith(
      "membershipChanged",
      { cookbookId: made.id, recipeId: "recipe-2", isMember: true },
      target
    );
  });

  it("sends what landed after the last boundary when an archive's count is off", async () => {
    mockArchiveParser.getArchiveInfo.mockResolvedValue({ format: "mealie-legacy", count: 3 });
    mockArchiveParser.importArchive.mockImplementation(
      async (
        _userId: string,
        _userIds: string[],
        _buffer: Buffer,
        onProgress: (...args: unknown[]) => void
      ) => {
        // Only two of the three counted entries were recipes.
        onProgress(1, { id: "recipe-1" });
        onProgress(2, { id: "recipe-2" });

        return { imported: [], errors: [], notes: [] };
      }
    );

    const caller = archiveRouter.createCaller({
      user: { id: "user-1" },
      userIds: ["user-1"],
      householdKey: "house-1",
    } as any);

    const formData = new FormData();
    const zip = new JSZip();

    zip.file("recipe/recipe.json", "{}");
    const zipBuffer = await zip.generateAsync({ type: "uint8array" });
    const zipArrayBuffer = zipBuffer.buffer.slice(
      zipBuffer.byteOffset,
      zipBuffer.byteOffset + zipBuffer.byteLength
    ) as ArrayBuffer;

    formData.append("file", new File([zipArrayBuffer], "mealie.zip"));

    await caller.importArchive(formData);

    for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setImmediate(resolve));

    expect(recipes.publish).toHaveBeenCalledWith(
      "recipeBatchCreated",
      { recipes: [{ id: "recipe-1" }, { id: "recipe-2" }] },
      expect.anything()
    );
  });
});
