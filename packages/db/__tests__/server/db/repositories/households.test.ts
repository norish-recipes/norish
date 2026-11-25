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
  deleteAccount,
  getHouseholdForUser,
  getHouseholdIdForUser,
  isHouseholdMember,
  joinHousehold,
  kickUserFromHousehold,
  moveToHouseholdOfOne,
  NEW_HOUSEHOLD_NAME,
  regenerateJoinCode,
  renameHouseholdOfOne,
  transferHouseholdAdmin,
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

    expect(await joinHousehold(member.id, { householdId })).toHaveProperty("joined");

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

  describe("deleting an account", () => {
    it("hands its admin role to the longest-standing member who stays", async () => {
      const { admin, member, householdId } = await sharedHousehold();
      const later = await createTestUser();

      await joinHousehold(later.id, { householdId });

      expect(await deleteAccount(admin.id)).toBe(member.id);
      expect(await getHouseholdForUser(member.id)).toMatchObject({
        id: householdId,
        adminUserId: member.id,
      });
    });

    it("takes a household of one with its last member", async () => {
      const user = await createTestUser();
      const householdId = await householdOf(user.id);

      expect(await deleteAccount(user.id)).toBeNull();
      expect(await getHouseholdMemberIdsByHouseholdId(householdId)).toEqual([]);
      expect(
        await getTestDb().select().from(households).where(eq(households.id, householdId))
      ).toEqual([]);
    });

    it("leaves a member's household to who stays", async () => {
      const { admin, member, householdId } = await sharedHousehold();

      expect(await deleteAccount(member.id)).toBeNull();
      expect(await getHouseholdMemberIdsByHouseholdId(householdId)).toEqual([admin.id]);
    });
  });

  describe("joining", () => {
    it("from an empty household of one moves the account and deletes the one it left", async () => {
      const admin = await createTestUser();
      const joiner = await createTestUser();
      const target = await householdOf(admin.id);
      const left = await householdOf(joiner.id);

      const outcome = await joinHousehold(joiner.id, { householdId: target });

      expect(outcome).toMatchObject({ leftHouseholdId: left });
      expect(await householdOf(joiner.id)).toBe(target);
      expect(await getHouseholdMemberIdsByHouseholdId(left)).toEqual([]);
    });

    it("is refused from a household of one that holds a recipe", async () => {
      const admin = await createTestUser();
      const joiner = await createTestUser();
      const own = await householdOf(joiner.id);

      await createTestRecipe(joiner.id, { name: "Soup" });

      expect(await joinHousehold(joiner.id, { householdId: await householdOf(admin.id) })).toEqual({
        refused: "holds-things",
      });
      expect(await householdOf(joiner.id)).toBe(own);
    });

    it("is refused from a household with other members", async () => {
      const { member, householdId } = await sharedHousehold();
      const other = await createTestUser();

      expect(await joinHousehold(member.id, { householdId: await householdOf(other.id) })).toEqual({
        refused: "shared",
      });
      expect(await householdOf(member.id)).toBe(householdId);
    });

    it("is refused into the household the account is already in", async () => {
      const user = await createTestUser();

      expect(await joinHousehold(user.id, { householdId: await householdOf(user.id) })).toEqual({
        refused: "already-member",
      });
    });
  });

  /** Client backends of this suite's own database waiting on a lock. */
  async function lockWaiters(): Promise<number> {
    const rows = await getTestDb().execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM pg_stat_activity
          WHERE datname = current_database() AND backend_type = 'client backend'
            AND wait_event_type = 'Lock'`
    );

    return rows.rows[0]!.n;
  }

  /**
   * Holds the household's row lock while `ops` queue behind it one by one, then
   * releases it, so they take the lock in the order given.
   */
  async function queueBehindLock(
    householdId: string,
    ops: Array<() => Promise<unknown>>,
    strength: "update" | "no key update" = "update"
  ) {
    // Idle repository connections, so every op runs at once.
    await Promise.all(ops.map(() => getHouseholdIdForUser(householdId)));

    const queued = await getTestDb().transaction(async (tx) => {
      await tx
        .select({ id: households.id })
        .from(households)
        .where(eq(households.id, householdId))
        .for(strength);

      const pending = new Set<Promise<unknown>>();
      const runs: Promise<unknown>[] = [];

      for (const op of ops) {
        const run: Promise<unknown> = op().finally(() => pending.delete(run));

        run.catch(() => undefined);
        pending.add(run);
        runs.push(run);

        while ((await lockWaiters()) < pending.size) await new Promise((r) => setTimeout(r, 10));
      }

      return runs;
    });

    return await Promise.allSettled(queued);
  }

  /** The invariant: each account in exactly one household, each admin one of its members. */
  async function expectEveryAccountHoused(userIds: string[]) {
    const memberships = await getTestDb().select().from(householdUsers);
    const all = await getTestDb().select().from(households);

    for (const userId of userIds) {
      expect(memberships.filter((m) => m.userId === userId)).toHaveLength(1);
    }
    for (const household of all) {
      expect(memberships).toContainEqual(
        expect.objectContaining({ householdId: household.id, userId: household.adminUserId })
      );
    }
  }

  describe("racing a join into a household that is going away", () => {
    it("never leaves an account without a household", async () => {
      const leaver = await createTestUser();
      const joiner = await createTestUser();
      const target = await createTestUser();
      const going = await householdOf(leaver.id);
      const targetHousehold = await householdOf(target.id);

      // Holds back deleting `going` without blocking a member being added to it.
      await queueBehindLock(
        going,
        [
          () => joinHousehold(leaver.id, { householdId: targetHousehold }),
          () => joinHousehold(joiner.id, { householdId: going }),
        ],
        "no key update"
      );

      await expectEveryAccountHoused([leaver.id, joiner.id, target.id]);
    });
  });

  describe("racing a join", () => {
    it("against deleting the household's last member leaves the joiner housed", async () => {
      const deleted = await createTestUser();
      const joiner = await createTestUser();
      const household = await householdOf(deleted.id);

      await queueBehindLock(household, [
        () => joinHousehold(joiner.id, { householdId: household }),
        () => deleteAccount(deleted.id),
      ]);

      await expectEveryAccountHoused([joiner.id]);
      expect(await householdOf(joiner.id)).toBe(household);
    });

    it("against rotating the join code refuses the old code", async () => {
      const admin = await createTestUser();
      const joiner = await createTestUser();
      const household = await householdOf(admin.id);
      const own = await householdOf(joiner.id);
      const { value } = await regenerateJoinCode(household);

      const [, joined] = await queueBehindLock(household, [
        () => regenerateJoinCode(household),
        () => joinHousehold(joiner.id, { joinCode: value!.joinCode! }),
      ]);

      expect(joined).toEqual({ status: "fulfilled", value: { refused: "gone" } });
      expect(await householdOf(joiner.id)).toBe(own);
    });

    it("against a claim's rename keeps the default name on the now shared household", async () => {
      const alone = await createTestUser();
      const joiner = await createTestUser();
      const household = await householdOf(alone.id);

      await queueBehindLock(household, [
        () => joinHousehold(joiner.id, { householdId: household }),
        () => renameHouseholdOfOne(alone.id, "The Smiths"),
      ]);

      expect((await getHouseholdForUser(alone.id))?.name).toBe(NEW_HOUSEHOLD_NAME);
    });
  });

  describe("racing an admin transfer against the new admin leaving", () => {
    it("never installs an admin who no longer lives there", async () => {
      const { admin, member, householdId } = await sharedHousehold();

      await queueBehindLock(householdId, [
        () => moveToHouseholdOfOne(householdId, member.id),
        () => transferHouseholdAdmin(householdId, admin.id, member.id),
      ]);

      await expectEveryAccountHoused([admin.id, member.id]);
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
