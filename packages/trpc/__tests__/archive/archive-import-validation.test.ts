// @vitest-environment node
import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

vi.mock("@norish/shared-server/archive/parser", () => mockArchiveParser);

vi.mock("@norish/shared-server/logger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/shared-server/logger")>();

  return {
    ...actual,
    trpcLogger: {
      debug: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
    },
  };
});

vi.mock("@norish/db/cached-household", () => ({
  getCachedHouseholdForUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@norish/queue/redis/subscription-multiplexer", () => ({
  getOrCreateMultiplexer: vi.fn(),
}));

vi.mock("@norish/trpc/routers/recipes/emitter", () => ({
  recipeEmitter: {
    emitToUser: vi.fn(),
    emitToHousehold: vi.fn(),
  },
}));

describe("archiveRouter.importArchive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts .paprikarecipes files", { timeout: 30000 }, async () => {
    const { archiveRouter } = await import("@norish/trpc/routers/archive/archive");

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
