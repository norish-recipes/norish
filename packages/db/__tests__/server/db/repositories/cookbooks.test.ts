// @vitest-environment node
/**
 * The cookbook repository against a real database.
 *
 * A mocked repository cannot prove that a policy condition filters or that a
 * unique pair holds, so these are the seams worth a container: who can see
 * which cookbook under each view policy, that an Orphaned cookbook is visible
 * under all of them, and what deleting either side of a membership does.
 */

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { RecipeListContext } from "@norish/db/repositories/recipes";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import {
  addRecipeToCookbook,
  createCookbook,
  deleteCookbookById,
  getCookbookForViewer,
  listCookbookMemberIds,
  listCookbooks,
  listCookbooksForRecipe,
  listEditableCookbooksForRecipe,
  removeRecipeFromCookbook,
  renameCookbook,
} from "@norish/db/repositories/cookbooks";
import { deleteRecipeById, listRecipes } from "@norish/db/repositories/recipes";
import { deleteConfig, setConfig } from "@norish/db/repositories/server-config";
import { cookbooks as cookbooksTable, recipeImages as recipeImagesTable } from "@norish/db/schema";

import { createTestRecipe, createTestUser, getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

type PermissionLevel = "everyone" | "household" | "owner";

function viewer(
  userId: string,
  { householdUserIds = null, isServerAdmin = false } = {} as {
    householdUserIds?: string[] | null;
    isServerAdmin?: boolean;
  }
): RecipeListContext {
  return { userId, householdUserIds, isServerAdmin };
}

async function setPolicy(level: {
  view: PermissionLevel;
  edit: PermissionLevel;
  delete: PermissionLevel;
}) {
  await setConfig(ServerConfigKeys.RECIPE_PERMISSION_POLICY, level, null, false);
}

/** Detach a cookbook's owner, the way deleting an account does. */
async function orphan(cookbookId: string) {
  await getTestDb()
    .update(cookbooksTable)
    .set({ userId: null })
    .where(eq(cookbooksTable.id, cookbookId));
}

describe("cookbook repository", () => {
  const testBase = new RepositoryTestBase("test_cookbooks");
  let ownerId: string;
  let strangerId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    ownerId = user.id;
    strangerId = (await createTestUser({ name: "Stranger" })).id;
    await deleteConfig(ServerConfigKeys.RECIPE_PERMISSION_POLICY);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  describe("the view policy", () => {
    it("shows another household's cookbook under `everyone` and hides it under `owner`", async () => {
      await setPolicy({ view: "everyone", edit: "household", delete: "household" });
      const cookbook = await createCookbook({ userId: ownerId, title: "Weeknights" });

      const seenByEveryone = await listCookbooks(viewer(strangerId), { limit: 50 });

      expect(seenByEveryone.cookbooks.map((c) => c.id)).toContain(cookbook.id);
      expect(seenByEveryone.total).toBe(1);

      await setPolicy({ view: "owner", edit: "owner", delete: "owner" });
      const seenByOwnerOnly = await listCookbooks(viewer(strangerId), { limit: 50 });

      expect(seenByOwnerOnly.cookbooks).toHaveLength(0);
      expect(seenByOwnerOnly.total).toBe(0);
      expect(await getCookbookForViewer(viewer(strangerId), cookbook.id)).toBeNull();
      expect(await getCookbookForViewer(viewer(ownerId), cookbook.id)).not.toBeNull();
    });

    it("shows a housemate's cookbook under `household` and a stranger's not at all", async () => {
      await setPolicy({ view: "household", edit: "household", delete: "household" });
      const cookbook = await createCookbook({ userId: ownerId, title: "Ours" });

      const housemate = viewer(strangerId, { householdUserIds: [strangerId, ownerId] });
      const outsider = viewer(strangerId, { householdUserIds: [strangerId] });

      expect((await listCookbooks(housemate, { limit: 50 })).cookbooks).toHaveLength(1);
      expect((await listCookbooks(outsider, { limit: 50 })).cookbooks).toHaveLength(0);
    });

    it("shows an Orphaned cookbook under every policy", async () => {
      const cookbook = await createCookbook({
        userId: ownerId,
        title: "From a departed housemate",
      });

      await orphan(cookbook.id);

      for (const level of ["everyone", "household", "owner"] as const) {
        await setPolicy({ view: level, edit: level, delete: level });

        const visible = await listCookbooks(viewer(strangerId), { limit: 50 });

        expect(
          visible.cookbooks.map((c) => c.id),
          `view: ${level}`
        ).toContain(cookbook.id);
        // Editable and deletable by everyone too, so a departure cannot strand it.
        const editable = await listEditableCookbooksForRecipe(
          viewer(strangerId),
          (await createTestRecipe(strangerId)).id
        );

        expect(
          editable.map((c) => c.id),
          `edit: ${level}`
        ).toContain(cookbook.id);
      }
    });

    it("shows a server admin everything under the tightest policy", async () => {
      await setPolicy({ view: "owner", edit: "owner", delete: "owner" });
      const cookbook = await createCookbook({ userId: ownerId, title: "Private" });

      const admin = viewer(strangerId, { isServerAdmin: true });

      expect((await listCookbooks(admin, { limit: 50 })).cookbooks.map((c) => c.id)).toContain(
        cookbook.id
      );
    });
  });

  describe("titles and sorting", () => {
    it("orders by the reader's sort and matches a title", async () => {
      const beta = await createCookbook({ userId: ownerId, title: "Beta bakes" });
      const alpha = await createCookbook({ userId: ownerId, title: "Alpha bakes" });

      const byTitle = await listCookbooks(viewer(ownerId), { limit: 50, sortMode: "titleAsc" });

      expect(byTitle.cookbooks.map((c) => c.title)).toEqual(["Alpha bakes", "Beta bakes"]);

      const newestFirst = await listCookbooks(viewer(ownerId), { limit: 50, sortMode: "dateDesc" });

      expect(newestFirst.cookbooks[0]?.id).toBe(alpha.id);
      expect(newestFirst.cookbooks[1]?.id).toBe(beta.id);

      const searched = await listCookbooks(viewer(ownerId), { limit: 50, search: "alpha" });

      expect(searched.cookbooks.map((c) => c.id)).toEqual([alpha.id]);
      expect(searched.total).toBe(1);
    });

    it("renames on a matching version and refuses a stale one", async () => {
      const cookbook = await createCookbook({ userId: ownerId, title: "Xmas" });

      const applied = await renameCookbook(cookbook.id, "Christmas baking", cookbook.version);

      expect(applied.applied).toBe(true);
      expect(applied.value?.title).toBe("Christmas baking");

      const stale = await renameCookbook(cookbook.id, "Nope", cookbook.version);

      expect(stale.stale).toBe(true);
      expect((await getCookbookForViewer(viewer(ownerId), cookbook.id))?.title).toBe(
        "Christmas baking"
      );
    });
  });

  describe("membership", () => {
    it("is unique on its pair, so filing twice changes nothing", async () => {
      const cookbook = await createCookbook({ userId: ownerId, title: "Weeknights" });
      const recipe = await createTestRecipe(ownerId, { name: "Pasta" });

      await addRecipeToCookbook(cookbook.id, recipe.id);
      await addRecipeToCookbook(cookbook.id, recipe.id);

      expect(await listCookbookMemberIds(cookbook.id)).toEqual([recipe.id]);
      expect((await getCookbookForViewer(viewer(ownerId), cookbook.id))?.memberCount).toBe(1);
    });

    it("adds and removes from the same place", async () => {
      const cookbook = await createCookbook({ userId: ownerId, title: "Weeknights" });
      const recipe = await createTestRecipe(ownerId, { name: "Pasta" });

      await addRecipeToCookbook(cookbook.id, recipe.id);
      expect(await listCookbooksForRecipe(viewer(ownerId), recipe.id)).toHaveLength(1);

      await removeRecipeFromCookbook(cookbook.id, recipe.id);
      expect(await listCookbooksForRecipe(viewer(ownerId), recipe.id)).toHaveLength(0);
      // Removing what is not there is a no-op rather than an error.
      await removeRecipeFromCookbook(cookbook.id, recipe.id);
    });

    it("reports what a recipe is in, per cookbook the reader may edit", async () => {
      await setPolicy({ view: "everyone", edit: "everyone", delete: "everyone" });
      const holding = await createCookbook({ userId: ownerId, title: "Holding" });
      const empty = await createCookbook({ userId: ownerId, title: "Empty" });
      const recipe = await createTestRecipe(strangerId, { name: "Someone else's" });

      await addRecipeToCookbook(holding.id, recipe.id);

      const editable = await listEditableCookbooksForRecipe(viewer(strangerId), recipe.id);
      const byId = new Map(editable.map((c) => [c.id, c.containsRecipe]));

      expect(byId.get(holding.id)).toBe(true);
      expect(byId.get(empty.id)).toBe(false);
    });

    it("counts only the members the reader can see", async () => {
      await setPolicy({ view: "owner", edit: "owner", delete: "owner" });
      const cookbook = await createCookbook({ userId: ownerId, title: "Shared" });

      // Orphaned, so both readers can see the cookbook itself under `owner`
      // and the only thing that differs is which members they can see.
      await orphan(cookbook.id);

      const mine = await createTestRecipe(strangerId, { name: "Mine" });
      const theirs = await createTestRecipe(ownerId, { name: "Theirs" });

      await addRecipeToCookbook(cookbook.id, mine.id);
      await addRecipeToCookbook(cookbook.id, theirs.id);

      // Two readers, two honest counts for the same cookbook (ADR-0027).
      expect((await getCookbookForViewer(viewer(strangerId), cookbook.id))?.memberCount).toBe(1);
      expect((await getCookbookForViewer(viewer(ownerId), cookbook.id))?.memberCount).toBe(1);
    });
  });

  describe("browsing a cookbook", () => {
    it("filters members by the same view policy the recipe list applies", async () => {
      await setPolicy({ view: "owner", edit: "owner", delete: "owner" });
      const cookbook = await createCookbook({ userId: ownerId, title: "Shared" });

      await orphan(cookbook.id);

      const mine = await createTestRecipe(strangerId, { name: "Mine" });
      const theirs = await createTestRecipe(ownerId, { name: "Theirs" });

      await addRecipeToCookbook(cookbook.id, mine.id);
      await addRecipeToCookbook(cookbook.id, theirs.id);

      const seen = await listRecipes(
        viewer(strangerId),
        50,
        0,
        undefined,
        ["title"],
        undefined,
        "AND",
        "dateDesc",
        undefined,
        undefined,
        undefined,
        { cookbookId: cookbook.id }
      );

      // Count and list agree by construction: the member query and the card's
      // count run the same policy condition (ADR-0027).
      expect(seen.recipes.map((recipe) => recipe.id)).toEqual([mine.id]);
      expect(seen.total).toBe(1);
      expect((await getCookbookForViewer(viewer(strangerId), cookbook.id))?.memberCount).toBe(1);
    });

    it("lists only members, under the reader's own sort and search", async () => {
      const cookbook = await createCookbook({ userId: ownerId, title: "Weeknights" });
      const inside = await createTestRecipe(ownerId, { name: "Aubergine bake" });
      const alsoInside = await createTestRecipe(ownerId, { name: "Bean stew" });

      await createTestRecipe(ownerId, { name: "Not filed" });
      await addRecipeToCookbook(cookbook.id, inside.id);
      await addRecipeToCookbook(cookbook.id, alsoInside.id);

      const byTitle = await listRecipes(
        viewer(ownerId),
        50,
        0,
        undefined,
        ["title"],
        undefined,
        "AND",
        "titleAsc",
        undefined,
        undefined,
        undefined,
        { cookbookId: cookbook.id }
      );

      expect(byTitle.recipes.map((recipe) => recipe.name)).toEqual(["Aubergine bake", "Bean stew"]);

      const searched = await listRecipes(
        viewer(ownerId),
        50,
        0,
        "aubergine",
        ["title"],
        undefined,
        "AND",
        "dateDesc",
        undefined,
        undefined,
        undefined,
        { cookbookId: cookbook.id }
      );

      expect(searched.recipes.map((recipe) => recipe.id)).toEqual([inside.id]);
    });

    it("builds a stable derived cover from the members' primary images", async () => {
      const cookbook = await createCookbook({ userId: ownerId, title: "Pictures" });
      const withImage = await createTestRecipe(ownerId, { name: "With picture" });

      await getTestDb()
        .insert(recipeImagesTable)
        .values({ recipeId: withImage.id, image: "/recipes/images/one.jpg", order: 0 });
      await addRecipeToCookbook(cookbook.id, withImage.id);
      // A member with no picture fills nothing rather than a blank tile.
      await addRecipeToCookbook(
        cookbook.id,
        (await createTestRecipe(ownerId, { name: "No picture" })).id
      );

      const first = await getCookbookForViewer(viewer(ownerId), cookbook.id);
      const second = await getCookbookForViewer(viewer(ownerId), cookbook.id);

      expect(first?.coverImages).toEqual(["/recipes/images/one.jpg"]);
      expect(second?.coverImages).toEqual(first?.coverImages);
      expect(first?.memberCount).toBe(2);
    });
  });

  describe("deletes", () => {
    it("deleting a recipe empties its cookbooks but leaves them standing", async () => {
      const cookbook = await createCookbook({ userId: ownerId, title: "Weeknights" });
      const recipe = await createTestRecipe(ownerId, { name: "Pasta" });

      await addRecipeToCookbook(cookbook.id, recipe.id);
      await deleteRecipeById(recipe.id);

      const surviving = await getCookbookForViewer(viewer(ownerId), cookbook.id);

      expect(surviving).not.toBeNull();
      expect(surviving?.title).toBe("Weeknights");
      expect(surviving?.memberCount).toBe(0);
      expect(await listCookbookMemberIds(cookbook.id)).toEqual([]);
    });

    it("deleting a cookbook leaves every recipe it held untouched", async () => {
      const cookbook = await createCookbook({ userId: ownerId, title: "Weeknights" });
      const recipe = await createTestRecipe(ownerId, { name: "Pasta" });

      await addRecipeToCookbook(cookbook.id, recipe.id);

      const deleted = await deleteCookbookById(cookbook.id, cookbook.version);

      expect(deleted.applied).toBe(true);
      expect(await getCookbookForViewer(viewer(ownerId), cookbook.id)).toBeNull();

      const recipesStillThere = await getTestDb().query.recipes.findMany();

      expect(recipesStillThere.map((r) => r.id)).toContain(recipe.id);
    });

    it("refuses a delete carrying a stale version", async () => {
      const cookbook = await createCookbook({ userId: ownerId, title: "Weeknights" });

      await renameCookbook(cookbook.id, "Renamed", cookbook.version);

      const stale = await deleteCookbookById(cookbook.id, cookbook.version);

      expect(stale.stale).toBe(true);
      expect(await getCookbookForViewer(viewer(ownerId), cookbook.id)).not.toBeNull();
    });
  });
});
