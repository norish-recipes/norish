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
vi.mock("@norish/shared-server/cache/household", () => householdCache);
vi.mock("@norish/trpc/routers/households/emitter", () => ({ householdEmitter }));
vi.mock("@norish/trpc/routers/permissions/emitter", () => ({ permissionsEmitter }));
vi.mock("@norish/trpc/connection-manager", () => connectionManager);
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getRecipePermissionPolicy: vi.fn().mockResolvedValue({ view: "household" }),
}));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("households.leave acknowledgement", () => {
  const user = createMockUser({ id: crypto.randomUUID() });
  const adminUserId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const household = {
    ...createMockHousehold(),
    id: crypto.randomUUID(),
    adminUserId,
    users: [
      { id: user.id, name: user.name ?? "Test User", version: 3 },
      { id: memberId, name: "Household Member", version: 2 },
    ],
  } as any;
  const ctx = createMockAuthedContext(user, household);

  beforeEach(() => {
    vi.clearAllMocks();
    householdDb.getHouseholdForUser.mockResolvedValue({
      ...household,
      version: 3,
    });
  });

  it("waits for membership removal and cache invalidation before acknowledging", async () => {
    const removal = deferred<{ stale: boolean }>();

    householdDb.removeUserFromHousehold.mockReturnValue(removal.promise);
    householdCache.invalidateHouseholdCacheForUsers.mockResolvedValue(undefined);
    connectionManager.emitConnectionInvalidation.mockResolvedValue(undefined);

    const caller = householdsRouter.createCaller({ ...ctx, multiplexer: null } as any);
    const resultPromise = caller.leave({ householdId: household.id, version: 3 });

    await Promise.resolve();
    expect(householdCache.invalidateHouseholdCacheForUsers).not.toHaveBeenCalled();

    removal.resolve({ stale: false });

    await expect(resultPromise).resolves.toEqual({ success: true, applied: true });

    expect(householdCache.invalidateHouseholdCacheForUsers).toHaveBeenCalledWith([
      user.id,
      memberId,
    ]);
    expect(householdEmitter.emitToUser).toHaveBeenCalledWith(memberId, "userLeft", {
      userId: user.id,
    });
  });

  it("throws membership failures without a failed realtime event", async () => {
    householdDb.removeUserFromHousehold.mockRejectedValue(new Error("connection lost"));

    const caller = householdsRouter.createCaller({ ...ctx, multiplexer: null } as any);
    await expect(caller.leave({ householdId: household.id, version: 3 })).rejects.toThrow(
      "connection lost"
    );

    expect(trpcLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: user.id }),
      "Failed to leave household"
    );
    expect(householdEmitter.emitToUser).not.toHaveBeenCalledWith(
      user.id,
      "failed",
      expect.anything()
    );
    expect(householdCache.invalidateHouseholdCacheForUsers).not.toHaveBeenCalled();
    expect(connectionManager.emitConnectionInvalidation).not.toHaveBeenCalled();
  });
});
