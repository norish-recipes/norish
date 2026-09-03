// @vitest-environment node
/**
 * The filing contract.
 *
 * Two things are worth pinning here, because both look wrong from outside:
 * filing needs view on the recipe and edit on the cookbook rather than edit on
 * both, and no membership mutation writes the recipe row (ADR-0027).
 */

import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { cookbookEmitter } from "../mocks/cookbook-emitter";
import {
  addRecipeToCookbook,
  createCookbook,
  getCookbookRow,
  listCookbookMemberIds,
  listCookbooksForRecipe,
  listEditableCookbooks,
  removeRecipeFromCookbook,
} from "../mocks/cookbooks-repository";
import { canAccessResource } from "../mocks/permissions";
import * as recipesRepository from "../mocks/recipes-repository";
import { createMockHousehold, createMockUser } from "../recipes/test-utils";

vi.mock("@norish/db/repositories/cookbooks", () => import("../mocks/cookbooks-repository"));
vi.mock("@norish/db/repositories/recipes", () => import("../mocks/recipes-repository"));
vi.mock("@norish/db", () => import("../mocks/recipes-repository"));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/shared-server/realtime/cookbooks", () => import("../mocks/cookbook-emitter"));
vi.mock("@norish/shared-server/config/server-config-loader", () => import("../mocks/config"));
vi.mock("@norish/shared-server/cache/household", () => ({
  getCachedHouseholdForUser: vi.fn().mockResolvedValue(null),
}));

const { cookbooksRouter } = await import("../../src/routers/cookbooks");
const { router, createCallerFactory } = await import("../../src/trpc");

const appRouter = router({ cookbooks: cookbooksRouter });

const COOKBOOK_ID = "11111111-1111-4111-8111-111111111111";
const RECIPE_ID = "33333333-3333-4333-8333-333333333333";

function callerFor(user = createMockUser()) {
  const household = createMockHousehold();

  return createCallerFactory(appRouter)({
    user,
    household: { id: household.id, name: household.name, users: household.users },
    connectionId: null,
    multiplexer: null,
    operationId: null,
  } as never);
}

function cookbookRow(overrides: Record<string, unknown> = {}) {
  return {
    id: COOKBOOK_ID,
    userId: "test-user-id",
    title: "Weeknights",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    version: 1,
    ...overrides,
  };
}

/** Every repository call that would write a recipe row. */
const RECIPE_WRITES = [
  "createRecipeWithRefs",
  "updateRecipeWithRefs",
  "updateRecipeCategories",
  "deleteRecipeById",
  "setActiveSystemForRecipe",
] as const;

function expectNoRecipeWrites() {
  for (const name of RECIPE_WRITES) {
    const fn = (recipesRepository as Record<string, unknown>)[name];

    if (typeof fn === "function" && "mock" in fn) {
      expect(fn, `${name} must not run for a membership mutation`).not.toHaveBeenCalled();
    }
  }
}

describe("cookbook membership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCookbookRow.mockResolvedValue(cookbookRow());
    recipesRepository.getRecipeOwnerId.mockResolvedValue("recipe-owner");
  });

  it("files a recipe the reader can see but not edit", async () => {
    // The reader may view the recipe and edit the cookbook.
    canAccessResource.mockResolvedValue(true);

    await expect(
      callerFor().cookbooks.setMembership({
        cookbookId: COOKBOOK_ID,
        recipeId: RECIPE_ID,
        isMember: true,
      })
    ).resolves.toMatchObject({ isMember: true });

    expect(addRecipeToCookbook).toHaveBeenCalledWith(COOKBOOK_ID, RECIPE_ID);
    expect(canAccessResource.mock.calls.map((call) => call[0])).toEqual(["view", "edit"]);
    expectNoRecipeWrites();
  });

  it("refuses a reader who cannot see the recipe", async () => {
    canAccessResource.mockImplementation(async (action: string) => action !== "view");

    await expect(
      callerFor().cookbooks.setMembership({
        cookbookId: COOKBOOK_ID,
        recipeId: RECIPE_ID,
        isMember: true,
      })
    ).rejects.toThrow(TRPCError);
    expect(addRecipeToCookbook).not.toHaveBeenCalled();
  });

  it("refuses a reader who cannot edit the cookbook", async () => {
    canAccessResource.mockImplementation(async (action: string) => action === "view");

    await expect(
      callerFor().cookbooks.setMembership({
        cookbookId: COOKBOOK_ID,
        recipeId: RECIPE_ID,
        isMember: true,
      })
    ).rejects.toThrow(TRPCError);
    expect(addRecipeToCookbook).not.toHaveBeenCalled();
  });

  it("takes a recipe out again from the same mutation, without writing the recipe", async () => {
    canAccessResource.mockResolvedValue(true);

    await callerFor().cookbooks.setMembership({
      cookbookId: COOKBOOK_ID,
      recipeId: RECIPE_ID,
      isMember: false,
    });

    expect(removeRecipeFromCookbook).toHaveBeenCalledWith(COOKBOOK_ID, RECIPE_ID);
    expect(addRecipeToCookbook).not.toHaveBeenCalled();
    expectNoRecipeWrites();
  });

  it("echoes membership on the cookbook, never on the recipe", async () => {
    canAccessResource.mockResolvedValue(true);

    await callerFor().cookbooks.setMembership({
      cookbookId: COOKBOOK_ID,
      recipeId: RECIPE_ID,
      isMember: true,
    });

    expect(cookbookEmitter.emitToHousehold).toHaveBeenCalledWith(
      "test-household-id",
      "membershipChanged",
      { cookbookId: COOKBOOK_ID, recipeId: RECIPE_ID, isMember: true }
    );
  });

  it("creates a cookbook already holding the recipe, in one step", async () => {
    canAccessResource.mockResolvedValue(true);
    createCookbook.mockResolvedValue({
      ...cookbookRow(),
      memberCount: 0,
      coverImages: [],
    });

    const result = await callerFor().cookbooks.create({
      title: "These two",
      recipeId: RECIPE_ID,
    });

    expect(addRecipeToCookbook).toHaveBeenCalledWith(COOKBOOK_ID, RECIPE_ID);
    expect(result.memberCount).toBe(1);
    expectNoRecipeWrites();
  });

  it("offers the cookbooks the reader may edit, whatever is being filed", async () => {
    // Not scoped to a recipe: the answer is the same for every recipe page,
    // which is what lets the Warm Set guarantee filing Offline (ADR-0009).
    listEditableCookbooks.mockResolvedValue([
      { ...cookbookRow(), memberCount: 1, coverImages: [] },
    ]);

    const result = await callerFor().cookbooks.editable();

    expect(result).toHaveLength(1);
    expect(listEditableCookbooks).toHaveBeenCalledWith({
      userId: "test-user-id",
      householdUserIds: ["test-user-id", "household-member-id"],
      isServerAdmin: false,
    });
  });

  it("reports which recipes a cookbook holds, to whoever may see the cookbook", async () => {
    // Seeing a cookbook is enough: this says nothing a reader could not learn
    // by opening it, and it is what lets bulk-adding leave out what is
    // already in there.
    canAccessResource.mockResolvedValue(true);
    listCookbookMemberIds.mockResolvedValue([RECIPE_ID]);

    const result = await callerFor().cookbooks.memberIds({ cookbookId: COOKBOOK_ID });

    expect(result).toEqual([RECIPE_ID]);
    expect(listCookbookMemberIds).toHaveBeenCalledWith(COOKBOOK_ID);
    expectNoRecipeWrites();
  });

  it("refuses the member ids of a cookbook the reader may not see", async () => {
    canAccessResource.mockResolvedValue(false);

    await expect(callerFor().cookbooks.memberIds({ cookbookId: COOKBOOK_ID })).rejects.toThrow(
      TRPCError
    );
    expect(listCookbookMemberIds).not.toHaveBeenCalled();
  });

  it("reports which cookbooks hold a recipe, for the panel and the card alike", async () => {
    canAccessResource.mockResolvedValue(true);
    listCookbooksForRecipe.mockResolvedValue([
      { ...cookbookRow(), memberCount: 1, coverImages: [] },
    ]);

    const result = await callerFor().cookbooks.forRecipe({ recipeId: RECIPE_ID });

    expect(result.map((cookbook) => cookbook.id)).toEqual([COOKBOOK_ID]);
  });
});
