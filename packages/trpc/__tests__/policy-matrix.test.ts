// @vitest-environment node
/**
 * The Permission Policy through the real procedures and the real access check: view, edit and
 * delete of recipes and cookbooks, under Everyone and Household. A server admin of another
 * household is an ordinary reader; a recipe they may not view reads as missing. Which cookbooks
 * a reader lists is the repositories' SQL, pinned against Postgres in packages/db.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipePermissionPolicy } from "@norish/config/zod/server-config";
import { ServerConfigKeys } from "@norish/config/zod/server-config";

import { createMockFullRecipe, createMockHousehold, createMockUser } from "./recipes/test-utils";

const RECIPE = "11111111-1111-4111-8111-111111111111";
const COOKBOOK = "22222222-2222-4222-8222-222222222222";
const ROW_HOUSEHOLD = "33333333-3333-4333-8333-333333333333";

const stored = vi.hoisted(() => ({ policy: {} as Record<string, string> }));
const repos = vi.hoisted(() => ({
  getRecipeHouseholdIds: vi.fn(),
  getRecipeFull: vi.fn(),
  deleteRecipesByIds: vi.fn(),
  getCookbookRow: vi.fn(),
  updateCookbook: vi.fn(),
  deleteCookbookById: vi.fn(),
}));

vi.mock("@norish/db/repositories/server-config", () => ({
  getConfig: vi.fn(async (key: string) =>
    key === ServerConfigKeys.RECIPE_PERMISSION_POLICY ? stored.policy : null
  ),
  getRecipePermissionPolicy: vi.fn(async () => stored.policy),
}));
vi.mock("@norish/db", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/db")>()),
  getRecipeHouseholdIds: repos.getRecipeHouseholdIds,
  getRecipeFull: repos.getRecipeFull,
  deleteRecipesByIds: repos.deleteRecipesByIds,
}));
vi.mock("@norish/db/repositories/cookbooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/db/repositories/cookbooks")>()),
  getCookbookRow: repos.getCookbookRow,
  updateCookbook: repos.updateCookbook,
  deleteCookbookById: repos.deleteCookbookById,
  withMemberSummaries: vi.fn(async () => []),
}));
vi.mock("@norish/shared-server/realtime/recipes", () => import("./mocks/realtime/recipes"));
vi.mock("@norish/shared-server/realtime/cookbooks", () => import("./mocks/realtime/cookbooks"));
vi.mock("@norish/shared-server/config/server-config-loader", () => import("./mocks/config"));
vi.mock("@norish/shared-server/media/storage", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/media/storage")>()),
  deleteRecipeImagesDir: vi.fn(),
  sweepCookbookImages: vi.fn(),
}));
vi.mock("@norish/shared-server/cache/household", () => ({
  getCachedHouseholdForUser: vi.fn().mockResolvedValue(null),
}));

const { recipesRouter } = await import("../src/routers/recipes");
const { cookbooksRouter } = await import("../src/routers/cookbooks");
const { router, createCallerFactory } = await import("../src/trpc");

const appRouter = router({ recipes: recipesRouter, cookbooks: cookbooksRouter });

/** A reader in `householdId`; `admin` makes them a server admin. */
function readerIn(householdId: string, admin = false) {
  const user = createMockUser({ id: `reader-of-${householdId}`, isServerAdmin: admin });
  const household = createMockHousehold({
    id: householdId,
    adminUserId: user.id,
    users: [{ id: user.id, name: "Reader" }],
  });

  return createCallerFactory(appRouter)({
    user,
    household: { id: household.id, name: household.name, users: household.users },
    connectionId: null,
    operationId: null,
  } as never);
}

const POLICIES: RecipePermissionPolicy[] = [
  { view: "everyone", edit: "everyone", delete: "everyone" },
  { view: "everyone", edit: "household", delete: "household" },
  { view: "everyone", edit: "everyone", delete: "household" },
  { view: "household", edit: "household", delete: "household" },
];

const READERS = [
  ["a member of another household", () => readerIn("reader-household")],
  ["a server admin of another household", () => readerIn("admin-household", true)],
] as const;

/** What a reader outside the row's household gets for `action`: through, refused, or not found. */
function expectedFor(policy: RecipePermissionPolicy, action: keyof RecipePermissionPolicy) {
  if (policy.view === "household") return "NOT_FOUND";

  return policy[action] === "everyone" ? "allowed" : "FORBIDDEN";
}

async function outcome(run: () => Promise<unknown>) {
  try {
    await run();

    return "allowed";
  } catch (error) {
    return (error as { code?: string }).code ?? "thrown";
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  // Only the row under test exists: a call with any other id finds nothing.
  repos.getRecipeHouseholdIds.mockImplementation(
    async (ids: string[]) =>
      new Map(ids.filter((id) => id === RECIPE).map((id) => [id, ROW_HOUSEHOLD]))
  );
  const recipe = createMockFullRecipe({
    id: RECIPE,
    userId: "owner",
    householdId: ROW_HOUSEHOLD,
    notes: "",
    version: 1,
    tags: [],
    recipeIngredients: [],
    steps: [],
    author: undefined,
  });

  repos.getRecipeFull.mockImplementation(async (id: string) => (id === RECIPE ? recipe : null));
  repos.deleteRecipesByIds.mockImplementation(async (items: Array<{ id: string }>) => ({
    deletedIds: items.map((item) => item.id),
    staleIds: [],
  }));
  repos.getCookbookRow.mockImplementation(async (id: string) =>
    id !== COOKBOOK
      ? null
      : {
          id: COOKBOOK,
          userId: "owner",
          householdId: ROW_HOUSEHOLD,
          title: "Weeknights",
          image: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          version: 1,
        }
  );
  repos.updateCookbook.mockResolvedValue({ stale: false, value: null });
  repos.deleteCookbookById.mockResolvedValue({ stale: false, value: undefined });
});

describe.each(POLICIES)("under view $view, edit $edit, delete $delete", (policy) => {
  beforeEach(() => {
    stored.policy = policy;
  });

  describe.each(READERS)("%s", (_, reader) => {
    it("views a recipe as the policy says", async () => {
      expect(await outcome(() => reader().recipes.get({ id: RECIPE }))).toBe(
        expectedFor(policy, "view")
      );
    });

    it("edits a recipe as the policy says", async () => {
      expect(await outcome(() => reader().recipes.getEditable({ id: RECIPE }))).toBe(
        expectedFor(policy, "edit")
      );
    });

    it("deletes a recipe as the policy says, and only then", async () => {
      await reader().recipes.delete({ recipes: [{ id: RECIPE, version: 1 }] });

      expect(repos.deleteRecipesByIds).toHaveBeenCalledWith(
        policy.view === "everyone" && policy.delete === "everyone"
          ? [{ id: RECIPE, version: 1 }]
          : []
      );
    });

    it("edits a cookbook as the policy says", async () => {
      expect(
        await outcome(() =>
          reader().cookbooks.update({ id: COOKBOOK, title: "Renamed", version: 1 })
        )
      ).toBe(expectedFor(policy, "edit"));
    });

    it("deletes a cookbook as the policy says", async () => {
      expect(await outcome(() => reader().cookbooks.remove({ id: COOKBOOK, version: 1 }))).toBe(
        expectedFor(policy, "delete")
      );
    });
  });

  it("lets a member of the row's own household do everything", async () => {
    const own = readerIn(ROW_HOUSEHOLD);

    expect(await outcome(() => own.recipes.get({ id: RECIPE }))).toBe("allowed");
    expect(await outcome(() => own.recipes.getEditable({ id: RECIPE }))).toBe("allowed");
    expect(
      await outcome(() => own.cookbooks.update({ id: COOKBOOK, title: "Renamed", version: 1 }))
    ).toBe("allowed");
    expect(await outcome(() => own.cookbooks.remove({ id: COOKBOOK, version: 1 }))).toBe("allowed");
  });
});

it("answers a missing recipe exactly as a hidden one", async () => {
  stored.policy = { view: "household", edit: "household", delete: "household" };
  const hidden = await outcome(() => readerIn("reader-household").recipes.get({ id: RECIPE }));

  repos.getRecipeHouseholdIds.mockResolvedValue(new Map());
  const missing = await outcome(() => readerIn("reader-household").recipes.get({ id: RECIPE }));

  expect([hidden, missing]).toEqual(["NOT_FOUND", "NOT_FOUND"]);
});
