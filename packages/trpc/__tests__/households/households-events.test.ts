// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { householdsRouter } from "@norish/trpc/routers/households/households";

import {
  createMockAuthedContext,
  createMockHousehold,
  createMockUser,
} from "../calendar/test-utils";

const householdDb = vi.hoisted(() => ({
  getAllergiesForUsers: vi.fn(),
  getHouseholdForUser: vi.fn(),
  isUserHouseholdAdmin: vi.fn(),
  joinHousehold: vi.fn(),
  kickUserFromHousehold: vi.fn(),
  moveToHouseholdOfOne: vi.fn(),
  regenerateJoinCode: vi.fn(),
  transferHouseholdAdmin: vi.fn(),
}));

const caldavSync = vi.hoisted(() => ({ chaseLeftBehindEvents: vi.fn(async () => undefined) }));

const householdCache = vi.hoisted(() => ({
  invalidateHouseholdCacheForUsers: vi.fn(),
}));

vi.mock("@norish/db", () => householdDb);
vi.mock("../../src/routers/caldav/sync-service", () => caldavSync);
vi.mock("@norish/shared-server/cache/household", () => householdCache);
vi.mock("@norish/shared-server/realtime/households", () => import("../mocks/realtime/households"));
vi.mock("@norish/shared-server/realtime/connection", () => import("../mocks/realtime/connection"));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const { emitConnectionInvalidation } = await import("../mocks/realtime/connection");
const { households } = await import("../mocks/realtime/households");

/** Mutations announce after they answer; the mocks resolve at once, so one loop turn runs it all. */
const settled = () => new Promise((resolve) => setImmediate(resolve));

/** Every cache drop, household event and invalidation, in the order they ran. */
function timeline(): string[] {
  const events = households.published.map((entry) => ({
    order: households.publish.mock.invocationCallOrder[households.published.indexOf(entry)]!,
    label: `household:${entry.event}`,
  }));
  const invalidations = emitConnectionInvalidation.mock.calls.map((call, index) => ({
    order: emitConnectionInvalidation.mock.invocationCallOrder[index]!,
    label: `connection.invalidate:${call[1]}`,
  }));
  const cacheDrops = householdCache.invalidateHouseholdCacheForUsers.mock.invocationCallOrder.map(
    (order) => ({ order, label: "cache:drop" })
  );

  return [...cacheDrops, ...events, ...invalidations]
    .sort((a, b) => a.order - b.order)
    .map((e) => e.label);
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
  const lateJoinerId = crypto.randomUUID();
  /** A move that went through, with the members its locked transaction left behind. */
  const moved = (memberIds: string[]) => ({
    stale: false,
    applied: true,
    value: { household: { id: "new-household" }, memberIds },
  });

  beforeEach(() => {
    households.reset();
    emitConnectionInvalidation.mockClear();
    householdCache.invalidateHouseholdCacheForUsers.mockClear();
    caldavSync.chaseLeftBehindEvents.mockClear();
    householdDb.getAllergiesForUsers.mockResolvedValue([]);
    householdDb.getHouseholdForUser.mockResolvedValue(household);
    householdDb.isUserHouseholdAdmin.mockResolvedValue(true);
  });

  it("join: drops the cache, tells the joiner, rescopes them, then tells the household", async () => {
    householdDb.joinHousehold.mockResolvedValue({
      joined: { householdId, version: 1 },
      leftHouseholdId: "own-household",
      memberIds: [memberId],
    });

    await householdsRouter.createCaller(ctx as never).join({ code: "123456" });
    await settled();

    expect(householdDb.joinHousehold).toHaveBeenCalledWith(user.id, { joinCode: "123456" });
    expect(timeline()).toEqual([
      "cache:drop",
      "household:created",
      "connection.invalidate:household-joined",
      "household:userJoined",
    ]);
    expect(households.published[1]!.channel).toBe(
      `norish:household:household:${householdId}:userJoined`
    );
  });

  it.each([
    ["shared", /Leave it first/],
    ["holds-things", /cannot join another household yet/],
    ["already-member", /already in this household/],
    ["gone", /Invalid join code/],
    ["expired", /join code has expired/],
  ] as const)("join: refuses a %s household and announces nothing", async (refused, message) => {
    householdDb.joinHousehold.mockResolvedValue({ refused });

    await expect(
      householdsRouter.createCaller(ctx as never).join({ code: "123456" })
    ).rejects.toThrow(message);
    await settled();

    expect(timeline()).toEqual([]);
  });

  it("join: refuses a malformed code as an invalid one without reaching the move", async () => {
    householdDb.joinHousehold.mockClear();

    await expect(householdsRouter.createCaller(ctx as never).join({ code: "123" })).rejects.toThrow(
      /Invalid join code/
    );

    expect(householdDb.joinHousehold).not.toHaveBeenCalled();
  });

  it("leave: the leaver gets their household of one and rescopes before the members hear it", async () => {
    const leaver = { ...household, adminUserId: memberId };

    householdDb.getHouseholdForUser
      .mockResolvedValueOnce(leaver)
      .mockResolvedValue({ ...household, id: "new-household", users: [household.users[0]] });
    householdDb.moveToHouseholdOfOne.mockResolvedValue(moved([memberId, lateJoinerId]));

    await householdsRouter.createCaller(ctx as never).leave({ householdId, version: 3 });
    await settled();

    expect(householdDb.moveToHouseholdOfOne).toHaveBeenCalledWith(householdId, user.id, 3);
    expect(timeline()).toEqual([
      "cache:drop",
      "household:created",
      "connection.invalidate:household-left",
      "household:userLeft",
      "household:userLeft",
    ]);
    // Who stays comes from the move itself, so a member who joined meanwhile hears it too.
    expect(householdCache.invalidateHouseholdCacheForUsers).toHaveBeenCalledWith([
      user.id,
      memberId,
      lateJoinerId,
    ]);
    expect(households.published[0]!.target).toEqual({ userId: user.id });
    expect(households.published[0]!.payload).toMatchObject({ household: { id: "new-household" } });
    expect(households.published[1]!.target).toEqual({ userId: memberId });
    expect(households.published[2]!.target).toEqual({ userId: lateJoinerId });
    // The leaver's synced entries of the household they left come off their calendar.
    expect(caldavSync.chaseLeftBehindEvents).toHaveBeenCalledWith(user.id);
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

  it("kick: the kicked user hears it and rescopes before the household hears it", async () => {
    householdDb.kickUserFromHousehold.mockResolvedValue(moved([user.id, lateJoinerId]));

    await householdsRouter
      .createCaller(ctx as never)
      .kick({ householdId, userId: memberId, version: 3 });
    await settled();

    expect(timeline()).toEqual([
      "cache:drop",
      "household:created",
      "household:userKicked",
      "connection.invalidate:household-kicked",
      "household:memberRemoved",
    ]);
    // The removed member gets their new household of one before their socket restarts.
    expect(households.published[0]!.target).toEqual({ userId: memberId });
    expect(householdCache.invalidateHouseholdCacheForUsers).toHaveBeenCalledWith([
      memberId,
      user.id,
      lateJoinerId,
    ]);
    expect(emitConnectionInvalidation).toHaveBeenCalledWith(memberId, "household-kicked");
    expect(caldavSync.chaseLeftBehindEvents).toHaveBeenCalledWith(memberId);
  });

  describe("an announcement that fails still rescopes the moved session and clears its calendar", () => {
    beforeEach(() => {
      households.publish.mockRejectedValueOnce(new Error("valkey down"));
    });

    it("join", async () => {
      householdDb.joinHousehold.mockResolvedValue({
        joined: { householdId, version: 1 },
        leftHouseholdId: "x",
        memberIds: [memberId],
      });

      await householdsRouter.createCaller(ctx as never).join({ code: "123456" });
      await settled();

      expect(householdCache.invalidateHouseholdCacheForUsers).toHaveBeenCalledWith([
        user.id,
        memberId,
      ]);
      expect(emitConnectionInvalidation).toHaveBeenCalledWith(user.id, "household-joined");
    });

    it("leave", async () => {
      householdDb.getHouseholdForUser.mockResolvedValue({ ...household, adminUserId: memberId });
      householdDb.moveToHouseholdOfOne.mockResolvedValue(moved([memberId]));

      await householdsRouter.createCaller(ctx as never).leave({ householdId, version: 3 });
      await settled();

      expect(householdCache.invalidateHouseholdCacheForUsers).toHaveBeenCalledWith([
        user.id,
        memberId,
      ]);
      expect(emitConnectionInvalidation).toHaveBeenCalledWith(user.id, "household-left");
      expect(caldavSync.chaseLeftBehindEvents).toHaveBeenCalledWith(user.id);
    });

    it("kick", async () => {
      householdDb.kickUserFromHousehold.mockResolvedValue(moved([user.id]));

      await householdsRouter
        .createCaller(ctx as never)
        .kick({ householdId, userId: memberId, version: 3 });
      await settled();

      expect(householdCache.invalidateHouseholdCacheForUsers).toHaveBeenCalledWith([
        memberId,
        user.id,
      ]);
      expect(emitConnectionInvalidation).toHaveBeenCalledWith(memberId, "household-kicked");
      expect(caldavSync.chaseLeftBehindEvents).toHaveBeenCalledWith(memberId);
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
    await settled();

    expect(timeline()).toEqual(["household:adminTransferred"]);
    expect(households.published[0]!.payload).toEqual({
      oldAdminId: user.id,
      newAdminId: memberId,
      version: 4,
    });
  });
});
