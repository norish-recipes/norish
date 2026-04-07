// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { trpcLogger } from "@norish/shared-server/logger";
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

const householdEmitter = vi.hoisted(() => ({
  emitToHousehold: vi.fn(),
  emitToUser: vi.fn(),
}));

const permissionsEmitter = vi.hoisted(() => ({
  emitToUser: vi.fn(),
}));

const connectionManager = vi.hoisted(() => ({
  emitConnectionInvalidation: vi.fn(),
}));

vi.mock("@norish/db", () => householdDb);
vi.mock("@norish/db/cached-household", () => householdCache);
vi.mock("@norish/trpc/routers/households/emitter", () => ({ householdEmitter }));
vi.mock("@norish/trpc/routers/permissions/emitter", () => ({ permissionsEmitter }));
vi.mock("@norish/trpc/connection-manager", () => connectionManager);
vi.mock("@norish/config/server-config-loader", () => ({
  getRecipePermissionPolicy: vi.fn().mockResolvedValue({ view: "household" }),
}));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe("household stale mutation handling", () => {
  const user = createMockUser({ id: crypto.randomUUID() });
  const adminUserId = crypto.randomUUID();
  const household = {
    ...createMockHousehold(),
    id: crypto.randomUUID(),
    adminUserId,
    users: [
      { id: user.id, name: user.name ?? "Test User", version: 3 },
      { id: adminUserId, name: "Household Member", version: 2 },
    ],
  } as any;
  const ctx = createMockAuthedContext(user, household);

  beforeEach(() => {
    vi.clearAllMocks();
    householdDb.getHouseholdForUser.mockResolvedValue({
      ...household,
      version: 3,
      users: [
        { id: user.id, name: user.name, version: 3 },
        { id: "household-member-id", name: "Household Member", version: 2 },
      ],
    });
  });

  it("logs stale leave mutations as no-ops", async () => {
    householdDb.removeUserFromHousehold.mockResolvedValue({ stale: true });

    const caller = householdsRouter.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.leave({ householdId: household.id, version: 3 });

    expect(result).toEqual({ success: true });
    await Promise.resolve();

    expect(trpcLogger.info).toHaveBeenCalledWith(
      { userId: ctx.user.id, householdId: household.id, version: 3 },
      "Ignoring stale household leave mutation"
    );
    expect(connectionManager.emitConnectionInvalidation).not.toHaveBeenCalled();
    expect(householdEmitter.emitToUser).not.toHaveBeenCalled();
  });
});
