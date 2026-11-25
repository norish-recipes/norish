// @vitest-environment node
/** What Search offers with no text, against a real database: four Categories with a photo, twelve Tags. */

import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { RecipeListContext } from "@norish/db/repositories/recipes";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { listLibraryDiscover } from "@norish/db/repositories/library";
import { deleteConfig, setConfig } from "@norish/db/repositories/server-config";
import { recipeImages } from "@norish/db/schema";

import {
  attachTestEntry,
  createTestRecipe,
  createTestUser,
  getTestDb,
  testHouseholdOf,
} from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

function viewer(userId: string): RecipeListContext {
  return { userId, householdId: testHouseholdOf(userId) };
}

describe("the discover reads", () => {
  const testBase = new RepositoryTestBase("test_library_discover");
  let ownerId: string;
  let strangerId: string;
  let clock = 0;
  /** One clock for every row, so no ordering rests on this machine's time. */
  const minute = () => new Date(Date.UTC(2026, 0, 1, 12, clock++));

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    ownerId = user.id;
    strangerId = (await createTestUser({ name: "Stranger" })).id;
    clock = 0;
    await deleteConfig(ServerConfigKeys.RECIPE_PERMISSION_POLICY);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const discover = async (as = ownerId) => await listLibraryDiscover(viewer(as));

  async function recipe(userId: string, image?: string) {
    const created = await createTestRecipe(userId, { name: "Dish", createdAt: minute() });

    if (image) {
      await getTestDb()
        .insert(recipeImages)
        .values({ recipeId: created.id, image, createdAt: minute() });
    }

    return created.id;
  }

  async function categorise(recipeIds: string[], name: string) {
    await attachTestEntry("category", recipeIds, name);
  }

  async function tag(recipeIds: string[], name: string) {
    await attachTestEntry("tag", recipeIds, name);
  }

  describe("Categories", () => {
    it("lists the built-ins first in their fixed order, then the rest, at most four", async () => {
      const id = await recipe(ownerId);

      for (const name of ["Zesty", "Snack", "Appetizer", "Dinner", "Breakfast"]) {
        await categorise([id], name);
      }

      expect((await discover()).categories.map((each) => each.name)).toEqual([
        "Breakfast",
        "Dinner",
        "Snack",
        "Appetizer",
      ]);
    });

    it("skips a Category with no recipe the reader can see", async () => {
      await setConfig(
        ServerConfigKeys.RECIPE_PERMISSION_POLICY,
        { view: "household", edit: "household", delete: "household" },
        null,
        false
      );
      await categorise([await recipe(strangerId, "/theirs.jpg")], "Lunch");
      await categorise([await recipe(ownerId)], "Dinner");
      // Seeded but on no recipe at all: Breakfast.

      expect(await discover()).toMatchObject({ categories: [{ name: "Dinner" }] });
    });

    it("shows the primary image of the newest visible recipe", async () => {
      const older = await recipe(ownerId, "/older.jpg");
      const newest = await recipe(ownerId, "/newest.jpg");
      const hidden = await recipe(ownerId, "/second.jpg");

      await getTestDb()
        .insert(recipeImages)
        .values({ recipeId: newest, image: "/newest-first.jpg", order: "-1", createdAt: minute() });
      await categorise([older, newest, hidden], "Dinner");

      // `hidden` is newest of all but belongs to a stranger once the policy is household-only.
      await setConfig(
        ServerConfigKeys.RECIPE_PERMISSION_POLICY,
        { view: "household", edit: "household", delete: "household" },
        null,
        false
      );
      await getTestDb().execute(
        sql`UPDATE recipes SET user_id = ${strangerId} WHERE id = ${hidden}`
      );

      expect((await discover()).categories).toEqual([
        { name: "Dinner", image: "/newest-first.jpg" },
      ]);
    });

    it("falls back to the newest recipe that has an image, and to none when no recipe has one", async () => {
      const photographed = await recipe(ownerId, "/photo.jpg");
      const bare = await recipe(ownerId);
      const alone = await recipe(ownerId);

      await categorise([photographed, bare], "Lunch");
      await categorise([alone], "Dinner");

      expect((await discover()).categories).toEqual([
        { name: "Lunch", image: "/photo.jpg" },
        { name: "Dinner", image: null },
      ]);
    });

    it("lists a Category once however many recipes hold it", async () => {
      await categorise([await recipe(ownerId), await recipe(ownerId)], "Dinner");

      expect((await discover()).categories).toHaveLength(1);
    });
  });

  describe("Tags", () => {
    it("lists the most-used first, counting recipes once, at most twelve", async () => {
      const [one, two, three] = [
        await recipe(ownerId),
        await recipe(ownerId),
        await recipe(ownerId),
      ];

      await tag([one, two, three], "popular");
      await tag([one, two], "common");
      for (let i = 0; i < 12; i++) await tag([one], `rare ${String(i).padStart(2, "0")}`);

      const { tags } = await discover();

      expect(tags).toHaveLength(12);
      expect(tags.slice(0, 3)).toEqual(["popular", "common", "rare 00"]);
    });

    it("breaks a tie by name", async () => {
      const id = await recipe(ownerId);

      await tag([id], "Soup");
      await tag([id], "apple");
      await tag([id], "Bread");

      expect((await discover()).tags).toEqual(["apple", "Bread", "Soup"]);
    });

    it("leaves out a Tag only on a recipe the reader cannot see", async () => {
      await setConfig(
        ServerConfigKeys.RECIPE_PERMISSION_POLICY,
        { view: "household", edit: "household", delete: "household" },
        null,
        false
      );
      await tag([await recipe(strangerId)], "secret");
      await tag([await recipe(ownerId)], "mine");

      expect((await discover()).tags).toEqual(["mine"]);
    });
  });

  it("returns nothing for a reader with no recipes", async () => {
    expect(await discover()).toEqual({ categories: [], tags: [] });
  });
});
