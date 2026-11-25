// @vitest-environment node

import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pendingProcedures } from "@norish/trpc/routers/recipes/pending";

import { policy, resetPermissionsMocks } from "../mocks/permissions";
import { createMockAuthedContext, createMockHousehold, createMockUser } from "./test-utils";

const mocks = vi.hoisted(() => ({
  recipeImport: vi.fn(),
  imageImport: vi.fn(),
  pasteImport: vi.fn(),
  getHouseholdIdForUser: vi.fn(),
}));

vi.mock("@norish/db/repositories/households", () => ({
  getHouseholdIdForUser: mocks.getHouseholdIdForUser,
}));

vi.mock("@norish/queue/registry", () => ({
  getQueues: vi.fn(() => ({
    recipeImport: { getJobs: mocks.recipeImport },
    imageImport: { getJobs: mocks.imageImport },
    pasteImport: { getJobs: mocks.pasteImport },
  })),
}));

vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));

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
  const ours = { userId: user.id, householdId: household.id };
  const theirs = { userId: "someone-else", householdId: "another-household" };

  beforeEach(() => {
    vi.clearAllMocks();
    resetPermissionsMocks();
    policy.view = "household";
    mocks.getHouseholdIdForUser.mockImplementation(async (userId: string) =>
      userId === user.id ? household.id : "another-household"
    );
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

  it("reads each import's household from its account now, not from when it was queued", async () => {
    // Queued while each account was in the other's household.
    mocks.recipeImport.mockResolvedValue([
      {
        data: { ...ours, householdId: "another-household", recipeId: "url-1", url: "a" },
        timestamp: 1,
      },
      { data: { ...theirs, householdId: household.id, recipeId: "url-2", url: "b" }, timestamp: 2 },
    ]);
    mocks.imageImport.mockResolvedValue([]);
    mocks.pasteImport.mockResolvedValue([]);

    const caller = t.createCallerFactory(t.router(pendingProcedures._def.procedures))(
      createMockAuthedContext(user, household)
    );

    await expect(caller.getPending()).resolves.toEqual([
      { recipeId: "url-1", url: "a", addedAt: 1 },
    ]);
  });
});
