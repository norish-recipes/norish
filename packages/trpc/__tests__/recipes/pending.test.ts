// @vitest-environment node

import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pendingProcedures } from "@norish/trpc/routers/recipes/pending";

import { createMockAuthedContext, createMockHousehold, createMockUser } from "./test-utils";

const mocks = vi.hoisted(() => ({
  recipeImport: vi.fn(),
  imageImport: vi.fn(),
  pasteImport: vi.fn(),
  getRecipePermissionPolicy: vi.fn(),
}));

vi.mock("@norish/queue/registry", () => ({
  getQueues: vi.fn(() => ({
    recipeImport: { getJobs: mocks.recipeImport },
    imageImport: { getJobs: mocks.imageImport },
    pasteImport: { getJobs: mocks.pasteImport },
  })),
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getRecipePermissionPolicy: mocks.getRecipePermissionPolicy,
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }),
  trpcLogger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const t = initTRPC.context<ReturnType<typeof createMockAuthedContext>>().create({
  transformer: superjson,
});

describe("recipes.getPending", () => {
  const user = createMockUser();
  const household = createMockHousehold();
  const ours = { userId: user.id, householdKey: household.id };
  const theirs = { userId: "someone-else", householdKey: "another-household" };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRecipePermissionPolicy.mockResolvedValue({ view: "household", edit: "household" });
  });

  it("lists running URL, image and pasted imports the reader may see", async () => {
    mocks.recipeImport.mockResolvedValue([
      { data: { ...ours, recipeId: "url-1", url: "https://example.com/a" }, timestamp: 1 },
      { data: { ...theirs, recipeId: "url-2", url: "https://example.com/b" }, timestamp: 2 },
    ]);
    mocks.imageImport.mockResolvedValue([{ data: { ...ours, recipeId: "image-1" }, timestamp: 3 }]);
    mocks.pasteImport.mockResolvedValue([
      { data: { ...ours, recipeIds: ["paste-1", "paste-2"] }, timestamp: 4 },
    ]);

    const caller = t.createCallerFactory(t.router(pendingProcedures._def.procedures))(
      createMockAuthedContext(user, household)
    );

    await expect(caller.getPending()).resolves.toEqual([
      { recipeId: "url-1", url: "https://example.com/a", addedAt: 1 },
      { recipeId: "image-1", url: "", addedAt: 3 },
      { recipeId: "paste-1", url: "", addedAt: 4 },
      { recipeId: "paste-2", url: "", addedAt: 4 },
    ]);
  });
});
