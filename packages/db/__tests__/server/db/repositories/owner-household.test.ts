// @vitest-environment node
/**
 * A recipe's and a cookbook's household is always its Owner's current one (ADR-0041): after
 * every membership change, and when a write races a move.
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { isRetryableConflict } from "@norish/db/repositories/constraint-violation";
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
import { raceBehind } from "../../../helpers/lock-race";
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

  it("stays put when a claim renames a household of one, and moves along when it joins", async () => {
    const owner = await createTestUser();
    const host = await createTestUser();
    const own = await householdOf(owner.id);
    const target = await householdOf(host.id);
    const recipe = await createTestRecipe(owner.id);
    const cookbook = await createCookbook({ userId: owner.id, title: "Mine" });

    expect(await renameHouseholdOfOne(owner.id, "Claimed")).toBe(own);
    expect(await householdsOf(recipe.id, cookbook.id)).toEqual([own, own]);
    expect(await joinHousehold(owner.id, { householdId: target })).toHaveProperty("joined");
    expect(await householdsOf(recipe.id, cookbook.id)).toEqual([target, target]);
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

    it("takes only its own refusal for a retry, not every serialization failure", () => {
      const serialization = Object.assign(new Error("could not serialize access"), {
        code: "40001",
      });

      expect(isRetryableConflict(new Error("Failed query", { cause: serialization }))).toBe(false);
    });

    it("refuses a recipe written during a move, for a retry", async () => {
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

      await expect(writing).rejects.toMatchObject({ cause: { code: "NH001" } });
      expect(isRetryableConflict(await writing.catch((error: unknown) => error))).toBe(true);
      expect(newHousehold).not.toBe(householdId);
      await expectInvariant();
    });
  });

  describe("a write racing a move, locked in the moves' order", () => {
    type Tx = Parameters<Parameters<ReturnType<typeof getTestDb>["transaction"]>[0]>[0];
    const holdHousehold = (id: string) => (tx: Tx) =>
      tx.select({ id: households.id }).from(households).where(eq(households.id, id)).for("update");
    const holdMembership = (userId: string) => (tx: Tx) =>
      tx
        .select({ userId: householdUsers.userId })
        .from(householdUsers)
        .where(eq(householdUsers.userId, userId))
        .for("update");
    const holdRecipe = (id: string) => (tx: Tx) =>
      tx.select({ id: recipes.id }).from(recipes).where(eq(recipes.id, id)).for("update");
    const fulfilled = (value: unknown) => ({ status: "fulfilled", value });

    async function recipeRow(id: string) {
      const [row] = await getTestDb()
        .select({ name: recipes.name, householdId: recipes.householdId })
        .from(recipes)
        .where(eq(recipes.id, id));

      return row;
    }

    const rename = (id: string, householdId: string) => () =>
      getTestDb().update(recipes).set({ name: "Renamed", householdId }).where(eq(recipes.id, id));

    it("settles a recipe insert queued before a leave", async () => {
      const { member, householdId } = await memberWithThings();

      const settled = await raceBehind(holdMembership(member.id), [
        () => createTestRecipe(member.id, { name: "Racing" }),
        () => moveToHouseholdOfOne(householdId, member.id),
      ]);
      const now = await householdOf(member.id);

      // The insert lands first, in the old household, and the leave then carries it along.
      expect(settled).toEqual([
        fulfilled(expect.objectContaining({ name: "Racing" })),
        fulfilled(expect.objectContaining({ applied: true })),
      ]);
      const inserted = (settled[0] as PromiseFulfilledResult<{ id: string }>).value;

      expect(now).not.toBe(householdId);
      expect((await recipeRow(inserted.id))?.householdId).toBe(now);
      await expectInvariant();
    });

    it("refuses a recipe insert queued behind a leave, for a retry", async () => {
      const { member, householdId } = await memberWithThings();

      const settled = await raceBehind(holdHousehold(householdId), [
        () => moveToHouseholdOfOne(householdId, member.id),
        () => createTestRecipe(member.id, { name: "Racing" }),
      ]);
      const now = await householdOf(member.id);

      // The insert locked the household the leave left: it is refused for a retry, never moved on.
      expect(now).not.toBe(householdId);
      expect(settled.map((s) => s.status)).toEqual(["fulfilled", "rejected"]);
      expect(settled[0]).toEqual(fulfilled(expect.objectContaining({ applied: true })));
      expect(JSON.stringify((settled[1] as PromiseRejectedResult).reason)).toMatch(
        /"code":"NH001"/
      );
      await expectInvariant();
    });

    it("refuses an insert whose household moved, under a deletion holding the new one", async () => {
      const { member, householdId } = await memberWithThings();

      const settled = await raceBehind(holdHousehold(householdId), [
        () => moveToHouseholdOfOne(householdId, member.id),
        () => createTestRecipe(member.id, { name: "Racing" }),
        () => deleteAccount(member.id),
      ]);

      // A conflict to retry, never a deadlock's victim (40P01), and nothing left behind.
      expect(settled.map((s) => s.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
      expect(JSON.stringify((settled[1] as PromiseRejectedResult).reason)).toMatch(
        /"code":"NH001"/
      );
      expect(
        await getTestDb()
          .select({ id: recipes.id })
          .from(recipes)
          .where(eq(recipes.userId, member.id))
      ).toEqual([]);
      await expectInvariant();
    });

    it("settles a recipe update queued before a leave", async () => {
      const { member, householdId, recipe } = await memberWithThings();
      const stranger = await householdOf((await createTestUser()).id);

      const settled = await raceBehind(holdRecipe(recipe.id), [
        rename(recipe.id, stranger),
        () => moveToHouseholdOfOne(householdId, member.id),
      ]);

      expect(settled).toEqual([
        fulfilled(expect.anything()),
        fulfilled(expect.objectContaining({ applied: true })),
      ]);
      expect(await recipeRow(recipe.id)).toEqual({
        name: "Renamed",
        householdId: await householdOf(member.id),
      });
      await expectInvariant();
    });

    it("settles a leave queued before a recipe update", async () => {
      const { member, householdId, recipe } = await memberWithThings();
      const stranger = await householdOf((await createTestUser()).id);

      const settled = await raceBehind(holdRecipe(recipe.id), [
        () => moveToHouseholdOfOne(householdId, member.id),
        rename(recipe.id, stranger),
      ]);

      expect(settled).toEqual([
        fulfilled(expect.objectContaining({ applied: true })),
        fulfilled(expect.anything()),
      ]);
      expect(await recipeRow(recipe.id)).toEqual({
        name: "Renamed",
        householdId: await householdOf(member.id),
      });
      await expectInvariant();
    });

    it("settles a cookbook insert queued before a join, which takes it along", async () => {
      const joiner = await createTestUser();
      const own = await householdOf(joiner.id);
      const target = await householdOf((await createTestUser()).id);

      const settled = await raceBehind(holdMembership(joiner.id), [
        () => createCookbook({ userId: joiner.id, title: "Racing" }),
        () => joinHousehold(joiner.id, { householdId: target }),
      ]);

      expect(settled).toEqual([
        fulfilled(expect.objectContaining({ householdId: own })),
        fulfilled(expect.objectContaining({ leftHouseholdId: own })),
      ]);
      const made = await getTestDb()
        .select({ householdId: cookbooks.householdId })
        .from(cookbooks)
        .where(eq(cookbooks.userId, joiner.id));

      expect(made).toEqual([{ householdId: target }]);
      await expectInvariant();
    });

    it("refuses a cookbook insert queued behind a join, for a retry", async () => {
      const joiner = await createTestUser();
      const own = await householdOf(joiner.id);
      const target = await householdOf((await createTestUser()).id);

      const settled = await raceBehind(holdHousehold(own), [
        () => joinHousehold(joiner.id, { householdId: target }),
        () => createCookbook({ userId: joiner.id, title: "Racing" }),
      ]);

      expect(settled[0]).toEqual(fulfilled(expect.objectContaining({ leftHouseholdId: own })));
      expect(JSON.stringify((settled[1] as PromiseRejectedResult).reason)).toMatch(
        /"code":"NH001"/
      );
      await expectInvariant();
    });

    it("settles a recipe insert queued before the account's deletion", async () => {
      const { member } = await memberWithThings();

      const settled = await raceBehind(holdMembership(member.id), [
        () => createTestRecipe(member.id, { name: "Racing" }),
        () => deleteAccount(member.id),
      ]);

      expect(settled.map((s) => s.status)).toEqual(["fulfilled", "fulfilled"]);
      expect(
        await getTestDb()
          .select({ id: recipes.id })
          .from(recipes)
          .where(eq(recipes.userId, member.id))
      ).toEqual([]);
      await expectInvariant();
    });

    it("settles an account deletion queued before a recipe insert", async () => {
      const { member, householdId } = await memberWithThings();

      const settled = await raceBehind(holdHousehold(householdId), [
        () => deleteAccount(member.id),
        () => createTestRecipe(member.id, { name: "Racing" }),
      ]);

      // Refused for a retry, which then finds the account gone; never a deadlock's victim.
      expect(settled.map((s) => s.status)).toEqual(["fulfilled", "rejected"]);
      expect(JSON.stringify((settled[1] as PromiseRejectedResult).reason)).toMatch(
        /"code":"NH001"/
      );
      expect(
        await getTestDb()
          .select({ id: recipes.id })
          .from(recipes)
          .where(eq(recipes.userId, member.id))
      ).toEqual([]);
      await expectInvariant();
    });
  });
});
