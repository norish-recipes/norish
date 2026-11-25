// @vitest-environment node
/**
 * Deleting recipes, through the real procedure.
 *
 * A stale delete is one that lost the race to an edit made elsewhere: the
 * recipe survives, so everything it owns has to survive with it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { policy, resetPermissionsMocks } from "../mocks/permissions";
import { recipes } from "../mocks/realtime/recipes";
import { createMockHousehold, createMockUser } from "./test-utils";

const mocks = vi.hoisted(() => ({
  deleteRecipesByIds: vi.fn(),
  getRecipeHouseholdIds: vi.fn(),
  deleteRecipeImagesDir: vi.fn(),
}));

vi.mock("@norish/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/db")>()),
  deleteRecipesByIds: mocks.deleteRecipesByIds,
  getRecipeHouseholdIds: mocks.getRecipeHouseholdIds,
}));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/shared-server/realtime/recipes", () => import("../mocks/realtime/recipes"));
vi.mock("@norish/shared-server/config/server-config-loader", () => import("../mocks/config"));
vi.mock("@norish/shared-server/media/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/media/storage")>()),
  deleteRecipeImagesDir: mocks.deleteRecipeImagesDir,
}));
vi.mock("@norish/shared-server/cache/household", () => ({
  getCachedHouseholdForUser: vi.fn().mockResolvedValue(null),
}));

const { recipesRouter } = await import("../../src/routers/recipes");
const { router, createCallerFactory } = await import("../../src/trpc");

const appRouter = router({ recipes: recipesRouter });

const MINE = "11111111-1111-4111-8111-111111111111";
const EDITED = "22222222-2222-4222-8222-222222222222";
const THEIRS = "33333333-3333-4333-8333-333333333333";
const GONE = "44444444-4444-4444-8444-444444444444";

function caller() {
  const household = createMockHousehold();

  return createCallerFactory(appRouter)({
    user: createMockUser(),
    household: { id: household.id, name: household.name, users: household.users },
    connectionId: null,
    operationId: null,
  } as never);
}

describe("recipes.delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPermissionsMocks();
    mocks.getRecipeHouseholdIds.mockImplementation(async (ids: string[]) => {
      const stored = new Map([
        [MINE, "test-household-id"],
        [EDITED, "test-household-id"],
        [THEIRS, "another-household"],
      ]);

      return new Map(ids.flatMap((id) => (stored.has(id) ? [[id, stored.get(id)!]] : [])));
    });
    mocks.deleteRecipesByIds.mockImplementation(async (items: Array<{ id: string }>) => ({
      deletedIds: items.map((item) => item.id).filter((id) => id !== EDITED),
      staleIds: items.some((item) => item.id === EDITED) ? [EDITED] : [],
    }));
  });

  it("keeps the images of a recipe whose delete was stale", async () => {
    await caller().recipes.delete({ recipes: [{ id: EDITED, version: 1 }] });

    expect(mocks.deleteRecipeImagesDir).not.toHaveBeenCalled();
  });

  it("deletes each recipe on its own and reports what was deleted and kept", async () => {
    const result = await caller().recipes.delete({
      recipes: [MINE, EDITED, THEIRS, GONE].map((id) => ({ id, version: 1 })),
    });

    // Another household's recipe is skipped, a gone one answers as deleted; neither is tried.
    expect(mocks.deleteRecipesByIds).toHaveBeenCalledWith(
      [MINE, EDITED].map((id) => ({ id, version: 1 }))
    );
    expect(result).toEqual({ deletedIds: [MINE, GONE], staleIds: [EDITED] });
    expect(mocks.deleteRecipeImagesDir.mock.calls.map(([id]) => id)).toEqual([MINE]);
  });

  it("answers a recipe out of view as a gone one, and touches nothing of it", async () => {
    policy.view = "household";

    const result = await caller().recipes.delete({ recipes: [{ id: THEIRS, version: 1 }] });

    expect(result).toEqual({ deletedIds: [THEIRS], staleIds: [] });
    expect(mocks.deleteRecipesByIds).toHaveBeenCalledWith([]);
    expect(mocks.deleteRecipeImagesDir).not.toHaveBeenCalled();
    expect(recipes.publish).not.toHaveBeenCalled();
  });

  it("deletes another household's recipe under delete Everyone", async () => {
    policy.delete = "everyone";

    await caller().recipes.delete({
      recipes: [
        { id: THEIRS, version: 1 },
        { id: MINE, version: 1 },
      ],
    });

    expect(mocks.deleteRecipesByIds).toHaveBeenCalledWith([
      { id: THEIRS, version: 1 },
      { id: MINE, version: 1 },
    ]);
    // Each recipe's own household hears of it, not the deleter's alone.
    expect(recipes.publish).toHaveBeenCalledWith(
      "deleted",
      { ids: [THEIRS] },
      { viewPolicy: "household", householdId: "another-household" }
    );
    expect(recipes.publish).toHaveBeenCalledWith(
      "deleted",
      { ids: [MINE] },
      { viewPolicy: "household", householdId: "test-household-id" }
    );
  });

  it("announces the deleted recipes to everyone and the kept ones to the caller", async () => {
    await caller().recipes.delete({
      recipes: [MINE, EDITED].map((id) => ({ id, version: 1 })),
    });

    expect(recipes.publish).toHaveBeenCalledWith(
      "deleted",
      { ids: [MINE] },
      { viewPolicy: "household", householdId: "test-household-id" }
    );
    expect(recipes.publish).toHaveBeenCalledWith(
      "deleteKept",
      { ids: [EDITED] },
      { userId: "test-user-id" }
    );
  });

  it("announces nothing when nothing was deleted or kept", async () => {
    await caller().recipes.delete({ recipes: [{ id: THEIRS, version: 1 }] });

    expect(recipes.publish).not.toHaveBeenCalled();
  });
});
