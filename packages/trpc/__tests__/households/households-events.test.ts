// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { householdsRouter } from "@norish/trpc/routers/households/households";

import {
  createMockAuthedContext,
  createMockHousehold,
  createMockUser,
} from "../calendar/test-utils";

const householdDb = vi.hoisted(() => ({
  findHouseholdByJoinCode: vi.fn(),
  getAllergiesForUsers: vi.fn(),
  getHouseholdForUser: vi.fn(),
  getUsersByHouseholdId: vi.fn(),
  isUserHouseholdAdmin: vi.fn(),
  joinHousehold: vi.fn(),
  kickUserFromHousehold: vi.fn(),
  moveToHouseholdOfOne: vi.fn(),
  regenerateJoinCode: vi.fn(),
  transferHouseholdAdmin: vi.fn(),
}));

const householdCache = vi.hoisted(() => ({
  invalidateHouseholdCacheForUsers: vi.fn(),
}));

vi.mock("@norish/db", () => householdDb);
vi.mock("@norish/shared-server/cache/household", () => householdCache);
vi.mock("@norish/shared-server/realtime/households", () => import("../mocks/realtime/households"));
vi.mock("@norish/shared-server/realtime/connection", () => import("../mocks/realtime/connection"));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const { emitConnectionInvalidation } = await import("../mocks/realtime/connection");
const { households } = await import("../mocks/realtime/households");

/** Let a mutation's detached promise chain run to the end. */
async function settle() {
  for (let i = 0; i < 10; i += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

/** Every household event and invalidation, in the order they were published. */
function timeline(): string[] {
  const events = households.published.map((entry) => ({
    order: households.publish.mock.invocationCallOrder[households.published.indexOf(entry)]!,
    label: `household:${entry.event}`,
  }));
  const invalidations = emitConnectionInvalidation.mock.calls.map((call, index) => ({
    order: emitConnectionInvalidation.mock.invocationCallOrder[index]!,
    label: `connection.invalidate:${call[1]}`,
  }));

  return [...events, ...invalidations].sort((a, b) => a.order - b.order).map((e) => e.label);
}

describe("household mutations announce before they restart the socket", () => {
  const user = createMockUser({ id: crypto.randomUUID() });
  const memberId = crypto.randomUUID();
  const householdId = crypto.randomUUID();
  const household = {
    ...createMockHousehold(),
    id: householdId,
    adminUserId: user.id,
    version: 3,
    users: [
      { id: user.id, name: user.name ?? "Test User", version: 3 },
      { id: memberId, name: "Household Member", version: 2 },
    ],
  };
  const ctx = createMockAuthedContext(user, household);

  beforeEach(() => {
    households.reset();
    householdDb.getAllergiesForUsers.mockResolvedValue([]);
    householdDb.getHouseholdForUser.mockResolvedValue(household);
    householdDb.getUsersByHouseholdId.mockResolvedValue([{ userId: memberId }]);
    householdDb.isUserHouseholdAdmin.mockResolvedValue(true);
  });

  it("join: the joiner and the household hear it before the invalidation", async () => {
    householdDb.findHouseholdByJoinCode.mockResolvedValue({
      id: householdId,
      joinCodeExpiresAt: null,
    });
    householdDb.joinHousehold.mockResolvedValue({
      joined: { version: 1 },
      leftHouseholdId: "own-household",
    });

    await householdsRouter.createCaller(ctx as never).join({ code: "123456" });
    await settle();

    expect(timeline()).toEqual([
      "household:created",
      "household:userJoined",
      "connection.invalidate:household-joined",
    ]);
    expect(households.published[1]!.channel).toBe(
      `norish:household:household:${householdId}:userJoined`
    );
  });

  it.each([
    ["shared", /Leave it first/],
    ["holds-things", /cannot join another household yet/],
    ["already-member", /already in this household/],
  ] as const)("join: refuses a %s household and announces nothing", async (refused, message) => {
    householdDb.findHouseholdByJoinCode.mockResolvedValue({
      id: householdId,
      joinCodeExpiresAt: null,
    });
    householdDb.joinHousehold.mockResolvedValue({ refused });

    await expect(
      householdsRouter.createCaller(ctx as never).join({ code: "123456" })
    ).rejects.toThrow(message);
    await settle();

    expect(timeline()).toEqual([]);
  });

  it("leave: the members hear `userLeft`, then the leaver gets their new household of one", async () => {
    const leaver = { ...household, adminUserId: memberId };

    householdDb.getHouseholdForUser
      .mockResolvedValueOnce(leaver)
      .mockResolvedValue({ ...household, id: "new-household", users: [household.users[0]] });
    householdDb.moveToHouseholdOfOne.mockResolvedValue({ stale: false, applied: true });

    await householdsRouter.createCaller(ctx as never).leave({ householdId, version: 3 });
    await settle();

    expect(householdDb.moveToHouseholdOfOne).toHaveBeenCalledWith(householdId, user.id, 3);
    expect(timeline()).toEqual([
      "household:userLeft",
      "household:created",
      "connection.invalidate:household-left",
    ]);
    expect(households.published[0]!.target).toEqual({ userId: memberId });
    expect(households.published[1]!.target).toEqual({ userId: user.id });
    expect(households.published[1]!.payload).toMatchObject({ household: { id: "new-household" } });
  });

  it("leave: refuses the only member, who has nowhere to leave to", async () => {
    householdDb.getHouseholdForUser.mockResolvedValue({
      ...household,
      users: [household.users[0]],
    });

    await expect(
      householdsRouter.createCaller(ctx as never).leave({ householdId, version: 3 })
    ).rejects.toThrow(/only member/);
    expect(householdDb.moveToHouseholdOfOne).not.toHaveBeenCalled();
  });

  it("leave: refuses an admin who has not handed the role on", async () => {
    await expect(
      householdsRouter.createCaller(ctx as never).leave({ householdId, version: 3 })
    ).rejects.toThrow(/transfer admin/);
    expect(householdDb.moveToHouseholdOfOne).not.toHaveBeenCalled();
  });

  it("kick: the kicked user and the household hear it before the kicked user's invalidation", async () => {
    householdDb.kickUserFromHousehold.mockResolvedValue({ stale: false });

    await householdsRouter
      .createCaller(ctx as never)
      .kick({ householdId, userId: memberId, version: 3 });
    await settle();

    expect(timeline()).toEqual([
      "household:created",
      "household:userKicked",
      "household:memberRemoved",
      "connection.invalidate:household-kicked",
    ]);
    // The removed member gets their new household of one before their socket restarts.
    expect(households.published[0]!.target).toEqual({ userId: memberId });
    expect(emitConnectionInvalidation).toHaveBeenCalledWith(memberId, "household-kicked");
  });

  describe("an announcement that fails still rescopes the moved session", () => {
    beforeEach(() => {
      emitConnectionInvalidation.mockClear();
      householdCache.invalidateHouseholdCacheForUsers.mockClear();
      households.publish.mockRejectedValueOnce(new Error("valkey down"));
    });

    it("join", async () => {
      householdDb.findHouseholdByJoinCode.mockResolvedValue({
        id: householdId,
        joinCodeExpiresAt: null,
      });
      householdDb.joinHousehold.mockResolvedValue({ joined: { version: 1 }, leftHouseholdId: "x" });

      await householdsRouter.createCaller(ctx as never).join({ code: "123456" });
      await settle();

      expect(householdCache.invalidateHouseholdCacheForUsers).toHaveBeenCalledWith([
        user.id,
        memberId,
      ]);
      expect(emitConnectionInvalidation).toHaveBeenCalledWith(user.id, "household-joined");
    });

    it("leave", async () => {
      householdDb.getHouseholdForUser.mockResolvedValue({ ...household, adminUserId: memberId });
      householdDb.moveToHouseholdOfOne.mockResolvedValue({ stale: false, applied: true });

      await householdsRouter.createCaller(ctx as never).leave({ householdId, version: 3 });
      await settle();

      expect(householdCache.invalidateHouseholdCacheForUsers).toHaveBeenCalledWith([
        user.id,
        memberId,
      ]);
      expect(emitConnectionInvalidation).toHaveBeenCalledWith(user.id, "household-left");
    });

    it("kick", async () => {
      householdDb.kickUserFromHousehold.mockResolvedValue({ stale: false });

      await householdsRouter
        .createCaller(ctx as never)
        .kick({ householdId, userId: memberId, version: 3 });
      await settle();

      expect(householdCache.invalidateHouseholdCacheForUsers).toHaveBeenCalledWith([
        memberId,
        user.id,
      ]);
      expect(emitConnectionInvalidation).toHaveBeenCalledWith(memberId, "household-kicked");
    });
  });

  it("admin transfer: the household hears `adminTransferred` and nobody's socket restarts", async () => {
    householdDb.transferHouseholdAdmin.mockResolvedValue({
      stale: false,
      value: { ...household, version: 4 },
    });

    await householdsRouter
      .createCaller(ctx as never)
      .transferAdmin({ householdId, newAdminId: memberId, version: 3 });
    await settle();

    expect(timeline()).toEqual(["household:adminTransferred"]);
    expect(households.published[0]!.payload).toEqual({
      oldAdminId: user.id,
      newAdminId: memberId,
      version: 4,
    });
  });
});
