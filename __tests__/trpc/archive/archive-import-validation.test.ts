// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";

const mockArchiveParser = vi.hoisted(() => ({
  importArchive: vi.fn().mockResolvedValue({ imported: [], skipped: [], errors: [] }),
  calculateBatchSize: vi.fn(() => 10),
  getArchiveInfo: vi.fn().mockResolvedValue({ format: "paprika", count: 1 }),
  ArchiveFormat: {
    MELA: "mela",
    MEALIE: "mealie",
    TANDOOR: "tandoor",
    PAPRIKA: "paprika",
    UNKNOWN: "unknown",
  },
}));

vi.mock("@/server/importers/archive-parser", () => mockArchiveParser);

vi.mock("@/server/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/logger")>();

  return {
    ...actual,
    trpcLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock("@/server/db/cached-household", () => ({
  getCachedHouseholdForUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/server/redis/subscription-multiplexer", () => ({
  getOrCreateMultiplexer: vi.fn(),
}));

vi.mock("@/server/trpc/routers/recipes/emitter", () => ({
  recipeEmitter: {
    emitToUser: vi.fn(),
    emitToHousehold: vi.fn(),
  },
}));

import { archiveRouter } from "@/server/trpc/routers/archive/archive";

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
});
