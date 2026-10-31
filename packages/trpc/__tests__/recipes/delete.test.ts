// @vitest-environment node
/**
 * Deleting recipes, through the real procedure.
 *
 * A stale delete is one that lost the race to an edit made elsewhere: the
 * recipe survives, so everything it owns has to survive with it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { canAccessResource } from "../mocks/permissions";
import { createMockHousehold, createMockUser } from "./test-utils";

const mocks = vi.hoisted(() => ({
  deleteRecipeById: vi.fn(),
  getRecipeOwnerId: vi.fn(),
  deleteRecipeImagesDir: vi.fn(),
}));

vi.mock("@norish/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/db")>()),
  deleteRecipeById: mocks.deleteRecipeById,
  getRecipeOwnerId: mocks.getRecipeOwnerId,
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

const RECIPE_ID = "33333333-3333-4333-8333-333333333333";

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
    mocks.getRecipeOwnerId.mockResolvedValue("test-user-id");
    canAccessResource.mockResolvedValue(true);
  });

  it("keeps the images of a recipe whose delete was stale", async () => {
    mocks.deleteRecipeById.mockResolvedValue({ applied: false, stale: true });

    await caller().recipes.delete({ id: RECIPE_ID, version: 1 });
    await vi.waitFor(() => expect(mocks.deleteRecipeById).toHaveBeenCalled());

    expect(mocks.deleteRecipeImagesDir).not.toHaveBeenCalled();
  });
});
