// @vitest-environment node
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { archiveRouter } from "@norish/trpc/routers/archive/archive";

import { archive } from "../mocks/realtime/archive";
import { recipes } from "../mocks/realtime/recipes";

const mockArchiveParser = vi.hoisted(() => ({
  importArchive: vi.fn().mockResolvedValue({ imported: [], skipped: [], errors: [] }),
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
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getRecipePermissionPolicy: vi.fn().mockResolvedValue({ view: "everyone" }),
}));

describe("archiveRouter.importArchive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

        return { imported: [recipe], skipped: [], errors: [] };
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
});
