// @vitest-environment node
/**
 * Every account is in exactly one household (ADR-0041): an account starts in a
 * household of one, leaving or removal ends in a new one, and joining from a
 * household of one is refused unless it holds nothing but its member.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  getHouseholdForUser,
  getHouseholdIdForUser,
  getHouseholdMemberIds,
  getHouseholdMemberIdsForUser,
  isHouseholdMember,
  joinHousehold,
  kickUserFromHousehold,
  moveToHouseholdOfOne,
  NEW_HOUSEHOLD_NAME,
} from "@norish/db/repositories/households";

import { createTestRecipe, createTestUser } from "../../../helpers/db-test-helpers";
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

      expect((await getHouseholdMemberIds(householdId)).sort()).toEqual(
        [admin.id, member.id].sort()
      );
      expect((await getHouseholdMemberIdsForUser(member.id)).sort()).toEqual(
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
      expect(await getHouseholdMemberIds(householdId)).toEqual([admin.id]);
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

    it("deletes a household nobody is left in", async () => {
      const user = await createTestUser();
      const householdId = await householdOf(user.id);

      const outcome = await moveToHouseholdOfOne(householdId, user.id);

      expect(await getHouseholdMemberIds(householdId)).toEqual([]);
      expect(await householdOf(user.id)).toBe(outcome.value!.id);
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
      expect(await getHouseholdMemberIds(left)).toEqual([]);
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
});
