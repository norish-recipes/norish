// @vitest-environment node

import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { describe, expect, it, vi } from "vitest";

import { createMockAuthedContext, createMockHousehold, createMockUser } from "./test-utils";

const addPasteImportJob = vi.fn();
const preparePasteImport = vi.fn();

vi.mock("@norish/queue", () => ({
  addPasteImportJob,
  preparePasteImport,
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

describe("importFromPasteProcedure", () => {
  it(
    "returns a batch-capable response and queues prepared payloads",
    { timeout: 30000 },
    async () => {
      const { importFromPasteProcedure } = await import("@norish/trpc/routers/recipes/recipes");
      const user = createMockUser();
      const household = createMockHousehold();
      const ctx = createMockAuthedContext(user, household);

      preparePasteImport.mockResolvedValue({
        batchId: "batch-1",
        recipeIds: ["123e4567-e89b-42d3-a456-426614174001", "123e4567-e89b-42d3-a456-426614174002"],
        text: "pasted",
        forceAI: false,
        structuredRecipes: [],
      });
      addPasteImportJob.mockResolvedValue({ status: "queued", job: { id: "job-1" } });

      const router = t.router({ importFromPaste: importFromPasteProcedure });
      const caller = t.createCallerFactory(router)(ctx);

      await expect(caller.importFromPaste({ text: "pasted" })).resolves.toEqual({
        recipeIds: ["123e4567-e89b-42d3-a456-426614174001", "123e4567-e89b-42d3-a456-426614174002"],
      });

      expect(preparePasteImport).toHaveBeenCalledWith("pasted", undefined);
      expect(addPasteImportJob).toHaveBeenCalledWith(
        {},
        expect.objectContaining({
          batchId: "batch-1",
          recipeIds: [
            "123e4567-e89b-42d3-a456-426614174001",
            "123e4567-e89b-42d3-a456-426614174002",
          ],
          userId: user.id,
          householdKey: ctx.householdKey,
          householdUserIds: ctx.householdUserIds,
        })
      );
    }
  );
});
