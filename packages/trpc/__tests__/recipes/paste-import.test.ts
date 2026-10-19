// @vitest-environment node

import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { importFromPasteProcedure } from "@norish/trpc/routers/recipes/recipes";

import { createMockAuthedContext, createMockHousehold, createMockUser } from "./test-utils";

const mocks = vi.hoisted(() => ({
  addPasteImportJob: vi.fn(),
  preparePasteImport: vi.fn(),
  getUserPreferences: vi.fn(),
}));

vi.mock("@norish/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@norish/db")>();

  return { ...actual, getUserPreferences: mocks.getUserPreferences };
});

vi.mock("@norish/queue", () => ({
  addPasteImportJob: mocks.addPasteImportJob,
  preparePasteImport: mocks.preparePasteImport,
}));

vi.mock("@norish/queue/registry", () => ({
  getQueues: vi.fn(() => ({ pasteImport: {} })),
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(),
  }),
  redactUrl: vi.fn((value: string) => value),
  trpcLogger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

const user = createMockUser();
const household = createMockHousehold();
const ctx = createMockAuthedContext(user, household);

function caller() {
  return t.createCallerFactory(t.router({ importFromPaste: importFromPasteProcedure }))(ctx);
}

const prepared = {
  batchId: "batch-1",
  recipeIds: ["123e4567-e89b-42d3-a456-426614174001", "123e4567-e89b-42d3-a456-426614174002"],
  text: "pasted",
  forceAI: false,
  structuredRecipes: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.preparePasteImport.mockResolvedValue(prepared);
  mocks.addPasteImportJob.mockResolvedValue({ status: "queued", job: { id: "job-1" } });
  mocks.getUserPreferences.mockResolvedValue({});
});

describe("importFromPasteProcedure", () => {
  it("returns a batch-capable response and queues prepared payloads", async () => {
    await expect(caller().importFromPaste({ text: "pasted" })).resolves.toEqual({
      recipeIds: prepared.recipeIds,
    });

    expect(mocks.preparePasteImport).toHaveBeenCalledWith("pasted", undefined);
    expect(mocks.addPasteImportJob).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        batchId: "batch-1",
        recipeIds: prepared.recipeIds,
        userId: user.id,
        householdKey: ctx.householdKey,
        householdUserIds: ctx.householdUserIds,
      })
    );
  });

  it("reads the profile default when the add did not state a choice", async () => {
    mocks.getUserPreferences.mockResolvedValue({ autoEnrichOnAdd: false });

    await caller().importFromPaste({ text: "pasted" });

    expect(mocks.addPasteImportJob).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ autoEnrich: false })
    );
  });

  it("lets the add's choice win over the profile default", async () => {
    mocks.getUserPreferences.mockResolvedValue({ autoEnrichOnAdd: false });

    await caller().importFromPaste({ text: "pasted", autoEnrich: true });

    expect(mocks.addPasteImportJob).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ autoEnrich: true })
    );
  });
});
