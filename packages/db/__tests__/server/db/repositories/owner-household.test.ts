// @vitest-environment node
/**
 * A recipe's and a cookbook's household is always its Owner's current one (ADR-0041): after
 * every membership change, and when a write races a move.
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createCookbook } from "@norish/db/repositories/cookbooks";
import {
  deleteAccount,
  getHouseholdIdForUser,
  joinHousehold,
  kickUserFromHousehold,
  moveToHouseholdOfOne,
  renameHouseholdOfOne,
} from "@norish/db/repositories/households";
import { cookbooks, households, householdUsers, recipes } from "@norish/db/schema";

import { createTestRecipe, createTestUser, getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("a recipe's household follows its Owner", () => {
  const testBase = new RepositoryTestBase("test_owner_household");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  const householdOf = async (userId: string) => (await getHouseholdIdForUser(userId))!;

  /** Every recipe and cookbook on the server is in its Owner's household now. */
  async function expectInvariant() {
    for (const table of [recipes, cookbooks]) {
      const strays = await getTestDb()
        .select({ id: table.id })
        .from(table)
        .leftJoin(
          householdUsers,
          sql`${householdUsers.userId} = ${table.userId} AND ${householdUsers.householdId} = ${table.householdId}`
        )
        .where(sql`${householdUsers.userId} IS NULL`);

      expect(strays).toEqual([]);
    }
  }

  async function householdsOf(recipeId: string, cookbookId: string) {
    const [recipe] = await getTestDb()
      .select({ householdId: recipes.householdId })
      .from(recipes)
      .where(eq(recipes.id, recipeId));
    const [cookbook] = await getTestDb()
      .select({ householdId: cookbooks.householdId })
      .from(cookbooks)
      .where(eq(cookbooks.id, cookbookId));

    return [recipe?.householdId, cookbook?.householdId];
  }

  /** An admin and a member in one household; the member owns a recipe and a cookbook there. */
  async function memberWithThings() {
    const admin = await createTestUser();
    const member = await createTestUser();
    const householdId = await householdOf(admin.id);

    await joinHousehold(member.id, { householdId });
    const recipe = await createTestRecipe(member.id, { name: "Member's soup" });
    const cookbook = await createCookbook({ userId: member.id, title: "Member's" });

    expect(await householdsOf(recipe.id, cookbook.id)).toEqual([householdId, householdId]);

    return { admin, member, householdId, recipe, cookbook };
  }

  it("is the Owner's on create, whatever household a write names", async () => {
    const owner = await createTestUser();
    const stranger = await createTestUser();
    const recipe = await createTestRecipe(owner.id, {
      householdId: await householdOf(stranger.id),
    });

    expect(recipe.householdId).toBe(await householdOf(owner.id));
    await expectInvariant();
  });

  it("moves with a member who leaves", async () => {
    const { member, householdId, recipe, cookbook } = await memberWithThings();

    const moved = await moveToHouseholdOfOne(householdId, member.id);
    const now = await householdOf(member.id);

    expect(moved.applied && now).not.toBe(householdId);
    expect(await householdsOf(recipe.id, cookbook.id)).toEqual([now, now]);
    await expectInvariant();
  });

  it("moves with a member the admin removes", async () => {
    const { admin, member, householdId, recipe, cookbook } = await memberWithThings();

    await kickUserFromHousehold(householdId, member.id, admin.id);
    const now = await householdOf(member.id);

    expect(await householdsOf(recipe.id, cookbook.id)).toEqual([now, now]);
    await expectInvariant();
  });

  it("stays put when a claim renames a household of one, and a join that holds things is refused", async () => {
    const owner = await createTestUser();
    const host = await createTestUser();
    const own = await householdOf(owner.id);
    const recipe = await createTestRecipe(owner.id);
    const cookbook = await createCookbook({ userId: owner.id, title: "Mine" });

    expect(await renameHouseholdOfOne(owner.id, "Claimed")).toBe(own);
    // Until ticket 09 merges, a household of one holding recipes and cookbooks cannot join.
    expect(await joinHousehold(owner.id, { householdId: await householdOf(host.id) })).toEqual({
      refused: "holds-things",
    });
    expect(await householdsOf(recipe.id, cookbook.id)).toEqual([own, own]);
    await expectInvariant();
  });

  it("lands in the joined household for what an account makes after joining", async () => {
    const host = await createTestUser();
    const joiner = await createTestUser();
    const householdId = await householdOf(host.id);

    await joinHousehold(joiner.id, { householdId });
    const recipe = await createTestRecipe(joiner.id);

    expect(recipe.householdId).toBe(householdId);
    await expectInvariant();
  });

  it("is untouched for who stays when another member's account is deleted", async () => {
    const { admin, member, householdId } = await memberWithThings();
    const kept = await createTestRecipe(admin.id, { name: "Admin's stew" });

    await deleteAccount(member.id);

    expect((await createTestRecipe(admin.id)).householdId).toBe(householdId);
    expect(
      await getTestDb().select({ id: recipes.id }).from(recipes).where(eq(recipes.id, kept.id))
    ).toEqual([{ id: kept.id }]);
    await expectInvariant();
  });

  describe("a write racing a move", () => {
    async function waitForLockWait() {
      const deadline = Date.now() + 3000;

      for (;;) {
        const { rows } = await getTestDb().execute<{ pid: number }>(
          sql`SELECT pid FROM pg_stat_activity
              WHERE datname = current_database() AND wait_event_type = 'Lock'`
        );

        if (rows.length > 0) return;
        if (Date.now() > deadline) throw new Error("Timed out waiting for a lock wait");
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }

    it("takes a recipe written first along when the member leaves after it", async () => {
      const { member, householdId } = await memberWithThings();
      let leaving: Promise<unknown> = Promise.resolve();
      let recipeId = "";

      await getTestDb().transaction(async (tx) => {
        const [row] = await tx
          .insert(recipes)
          .values({ userId: member.id, name: "Written first" })
          .returning({ id: recipes.id });

        recipeId = row!.id;
        // The leave waits on the membership row the write holds, then moves what is committed.
        leaving = moveToHouseholdOfOne(householdId, member.id);
        leaving.catch(() => undefined);
        await waitForLockWait();
      });
      await leaving;

      const [stored] = await getTestDb()
        .select({ householdId: recipes.householdId })
        .from(recipes)
        .where(eq(recipes.id, recipeId));

      expect(stored?.householdId).toBe(await householdOf(member.id));
      expect(stored?.householdId).not.toBe(householdId);
      await expectInvariant();
    });

    it("puts a recipe written during a move in the household the move ends in", async () => {
      const { member, householdId } = await memberWithThings();
      let writing: Promise<{ householdId: string }> = Promise.resolve({ householdId: "" });
      let newHousehold = "";

      await getTestDb().transaction(async (tx) => {
        // A move as the repository makes one, held open while a recipe is written.
        await tx.delete(householdUsers).where(eq(householdUsers.userId, member.id));
        const [made] = await tx
          .insert(households)
          .values({ name: "Moved", adminUserId: member.id })
          .returning({ id: households.id });

        newHousehold = made!.id;
        await tx.insert(householdUsers).values({ householdId: newHousehold, userId: member.id });
        writing = createTestRecipe(member.id, { name: "Written during" });
        writing.catch(() => undefined);
        await waitForLockWait();
      });

      expect((await writing).householdId).toBe(newHousehold);
      expect(newHousehold).not.toBe(householdId);
      await expectInvariant();
    });
  });
});
