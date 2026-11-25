// @vitest-environment node
/**
 * Every account is in exactly one household (ADR-0041): an account starts in a
 * household of one, leaving or removal ends in a new one, and joining from a
 * household of one is refused unless it holds nothing but its member.
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  getHouseholdMemberIdsByHouseholdId,
  getHouseholdMemberIdsByUserId,
} from "@norish/db/repositories/household-members";
import {
  getHouseholdForUser,
  getHouseholdIdForUser,
  isHouseholdMember,
  joinHousehold,
  kickUserFromHousehold,
  moveToHouseholdOfOne,
  NEW_HOUSEHOLD_NAME,
} from "@norish/db/repositories/households";
import { households, householdUsers } from "@norish/db/schema";

import { createTestRecipe, createTestUser, getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("households", () => {
  const testBase = new RepositoryTestBase("test_households");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function householdOf(userId: string): Promise<string> {
    const id = await getHouseholdIdForUser(userId);

    expect(id).not.toBeNull();

    return id!;
  }

  /** An admin and a member in one household, as joining with a code makes one. */
  async function sharedHousehold() {
    const admin = await createTestUser();
    const member = await createTestUser();
    const householdId = await householdOf(admin.id);

    expect(await joinHousehold(member.id, householdId)).toHaveProperty("joined");

    return { admin, member, householdId };
  }

  describe("a new account", () => {
    it("starts in a household of one that it administers", async () => {
      const user = await createTestUser();
      const household = await getHouseholdForUser(user.id);

      expect(household).toMatchObject({ name: NEW_HOUSEHOLD_NAME, adminUserId: user.id });
      expect(household!.users.map((u) => u.id)).toEqual([user.id]);
    });

    it("gets a household of its own, not another account's", async () => {
      const a = await createTestUser();
      const b = await createTestUser();

      expect(await householdOf(a.id)).not.toBe(await householdOf(b.id));
    });
  });

  describe("reading the household by id", () => {
    it("lists its members, and the members of an account's household", async () => {
      const { admin, member, householdId } = await sharedHousehold();
      const outsider = await createTestUser();

      expect((await getHouseholdMemberIdsByHouseholdId(householdId)).sort()).toEqual(
        [admin.id, member.id].sort()
      );
      expect((await getHouseholdMemberIdsByUserId(member.id)).sort()).toEqual(
        [admin.id, member.id].sort()
      );
      expect(await isHouseholdMember(householdId, member.id)).toBe(true);
      expect(await isHouseholdMember(householdId, outsider.id)).toBe(false);
    });
  });

  describe("leaving or being removed", () => {
    it("puts the member in a new household of one and keeps the household for who stays", async () => {
      const { admin, member, householdId } = await sharedHousehold();

      const outcome = await moveToHouseholdOfOne(householdId, member.id);

      expect(outcome.applied).toBe(true);
      expect(outcome.value).toMatchObject({ name: NEW_HOUSEHOLD_NAME, adminUserId: member.id });
      expect(await householdOf(member.id)).toBe(outcome.value!.id);
      expect(await getHouseholdMemberIdsByHouseholdId(householdId)).toEqual([admin.id]);
    });

    it("gives the new household a join code", async () => {
      const { member, householdId } = await sharedHousehold();

      const outcome = await moveToHouseholdOfOne(householdId, member.id);

      expect(outcome.value?.joinCode).toMatch(/^\d{6}$/);
    });

    it("by the admin's hand, ends the same way", async () => {
      const { admin, member, householdId } = await sharedHousehold();

      const outcome = await kickUserFromHousehold(householdId, member.id, admin.id);

      expect(outcome.applied).toBe(true);
      expect(await householdOf(member.id)).toBe(outcome.value!.id);
      expect(await isHouseholdMember(householdId, member.id)).toBe(false);
    });

    it("changes nothing on a stale version, so the member keeps their household", async () => {
      const { member, householdId } = await sharedHousehold();

      const outcome = await moveToHouseholdOfOne(householdId, member.id, 999);

      expect(outcome.stale).toBe(true);
      expect(await householdOf(member.id)).toBe(householdId);
    });
  });

  describe("joining", () => {
    it("from an empty household of one moves the account and deletes the one it left", async () => {
      const admin = await createTestUser();
      const joiner = await createTestUser();
      const target = await householdOf(admin.id);
      const left = await householdOf(joiner.id);

      const outcome = await joinHousehold(joiner.id, target);

      expect(outcome).toMatchObject({ leftHouseholdId: left });
      expect(await householdOf(joiner.id)).toBe(target);
      expect(await getHouseholdMemberIdsByHouseholdId(left)).toEqual([]);
    });

    it("is refused from a household of one that holds a recipe", async () => {
      const admin = await createTestUser();
      const joiner = await createTestUser();
      const own = await householdOf(joiner.id);

      await createTestRecipe(joiner.id, { name: "Soup" });

      expect(await joinHousehold(joiner.id, await householdOf(admin.id))).toEqual({
        refused: "holds-things",
      });
      expect(await householdOf(joiner.id)).toBe(own);
    });

    it("is refused from a household with other members", async () => {
      const { member, householdId } = await sharedHousehold();
      const other = await createTestUser();

      expect(await joinHousehold(member.id, await householdOf(other.id))).toEqual({
        refused: "shared",
      });
      expect(await householdOf(member.id)).toBe(householdId);
    });

    it("is refused into the household the account is already in", async () => {
      const user = await createTestUser();

      expect(await joinHousehold(user.id, await householdOf(user.id))).toEqual({
        refused: "already-member",
      });
    });
  });

  describe("racing a join into a household that is going away", () => {
    /** Rows waiting on a lock, read from a connection outside the race. */
    async function lockWaiters(): Promise<number> {
      const rows = await getTestDb().execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM pg_locks WHERE NOT granted`
      );

      return rows.rows[0]!.n;
    }

    it("never leaves an account without a household", async () => {
      const leaver = await createTestUser();
      const joiner = await createTestUser();
      const target = await createTestUser();
      const going = await householdOf(leaver.id);

      // Two idle repository connections, so both joins run at once.
      await Promise.all([householdOf(joiner.id), householdOf(target.id)]);

      // Holds back deleting `going` without blocking a member being added to it.
      const holder = getTestDb().transaction(async (tx) => {
        await tx
          .select({ id: households.id })
          .from(households)
          .where(eq(households.id, going))
          .for("no key update");

        const leaving = joinHousehold(leaver.id, await householdOf(target.id));

        while ((await lockWaiters()) < 1) await new Promise((r) => setTimeout(r, 10));

        let settled = false;
        const joining = joinHousehold(joiner.id, going).finally(() => (settled = true));

        while (!settled && (await lockWaiters()) < 2) await new Promise((r) => setTimeout(r, 10));

        return [leaving, joining] as const;
      });

      const [leaving, joining] = await holder;

      await Promise.allSettled([leaving, joining]);

      const memberships = await getTestDb()
        .select({ userId: householdUsers.userId })
        .from(householdUsers);

      for (const user of [leaver, joiner, target]) {
        expect(memberships.filter((m) => m.userId === user.id)).toHaveLength(1);
      }
    });
  });

  describe("moving out, checked under the household's lock", () => {
    it("refuses the admin of a household with other members", async () => {
      const { admin, householdId } = await sharedHousehold();

      await expect(moveToHouseholdOfOne(householdId, admin.id)).rejects.toThrow();
      expect(await householdOf(admin.id)).toBe(householdId);
    });

    it("refuses the household's last member", async () => {
      const user = await createTestUser();
      const householdId = await householdOf(user.id);

      await expect(moveToHouseholdOfOne(householdId, user.id)).rejects.toThrow();
      expect(await householdOf(user.id)).toBe(householdId);
    });

    it("refuses a removal by someone who is not the admin", async () => {
      const { admin, member, householdId } = await sharedHousehold();

      await expect(kickUserFromHousehold(householdId, admin.id, member.id)).rejects.toThrow();
      expect(await householdOf(admin.id)).toBe(householdId);
    });
  });
});
