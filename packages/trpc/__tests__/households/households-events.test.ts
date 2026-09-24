// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { householdsRouter } from "@norish/trpc/routers/households/households";

import {
  createMockAuthedContext,
  createMockHousehold,
  createMockUser,
} from "../calendar/test-utils";

const householdDb = vi.hoisted(() => ({
  addUserToHousehold: vi.fn(),
  createHousehold: vi.fn(),
  findHouseholdByJoinCode: vi.fn(),
  getAllergiesForUsers: vi.fn(),
  getHouseholdForUser: vi.fn(),
  getUsersByHouseholdId: vi.fn(),
  isUserHouseholdAdmin: vi.fn(),
  kickUserFromHousehold: vi.fn(),
  regenerateJoinCode: vi.fn(),
  removeUserFromHousehold: vi.fn(),
  transferHouseholdAdmin: vi.fn(),
}));

const householdCache = vi.hoisted(() => ({
  invalidateHouseholdCache: vi.fn(),
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
    vi.clearAllMocks();
    households.reset();
    householdDb.getAllergiesForUsers.mockResolvedValue([]);
    householdDb.getHouseholdForUser.mockResolvedValue(household);
    householdDb.getUsersByHouseholdId.mockResolvedValue([{ userId: memberId }]);
    householdDb.isUserHouseholdAdmin.mockResolvedValue(true);
  });

  it("create: the creator hears `created` before the invalidation", async () => {
    householdDb.getHouseholdForUser.mockResolvedValueOnce(null).mockResolvedValue(household);
    householdDb.createHousehold.mockResolvedValue({ id: householdId });
    householdDb.addUserToHousehold.mockResolvedValue({ version: 1 });
    householdDb.regenerateJoinCode.mockResolvedValue({ value: household });

    await householdsRouter.createCaller(ctx as never).create({ name: "Home" });
    await settle();

    expect(timeline()).toEqual(["household:created", "connection.invalidate:household-created"]);
    expect(households.published[0]!.target).toEqual({ userId: user.id });
  });

  it("join: the joiner and the household hear it before the invalidation", async () => {
    householdDb.getHouseholdForUser.mockResolvedValueOnce(null).mockResolvedValue(household);
    householdDb.findHouseholdByJoinCode.mockResolvedValue({
      id: householdId,
      joinCodeExpiresAt: null,
    });
    householdDb.addUserToHousehold.mockResolvedValue({ version: 1 });

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

  it("leave: the remaining members hear `userLeft` before the leaver's invalidation", async () => {
    householdDb.getHouseholdForUser.mockResolvedValue({ ...household, adminUserId: memberId });
    householdDb.removeUserFromHousehold.mockResolvedValue({ stale: false });

    await householdsRouter.createCaller(ctx as never).leave({ householdId, version: 3 });
    await settle();

    expect(timeline()).toEqual(["household:userLeft", "connection.invalidate:household-left"]);
    expect(households.published[0]!.target).toEqual({ userId: memberId });
  });

  it("kick: the kicked user and the household hear it before the kicked user's invalidation", async () => {
    householdDb.kickUserFromHousehold.mockResolvedValue({ stale: false });

    await householdsRouter
      .createCaller(ctx as never)
      .kick({ householdId, userId: memberId, version: 3 });
    await settle();

    expect(timeline()).toEqual([
      "household:userKicked",
      "household:memberRemoved",
      "connection.invalidate:household-kicked",
    ]);
    expect(emitConnectionInvalidation).toHaveBeenCalledWith(memberId, "household-kicked");
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
