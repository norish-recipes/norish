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

const flushAsync = () => new Promise((resolve) => setTimeout(resolve, 0));

/**
 * CHARACTERIZATION — documents the current fire-and-forget acknowledgement of
 * `households.leave` (audit matrix: openspec/changes/make-mutation-acks-truthful).
 *
 * Pins today's untruthful behavior as the regression baseline. After conversion,
 * rewrite to assert: success only after the membership write AND cache invalidation
 * completed, errors thrown, connection termination still deferred post-response.
 */
describe("households.leave acknowledgement characterization", () => {
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

  it("returns success while the membership write and cache invalidation are still pending", async () => {
    const removal = deferred<{ stale: boolean }>();

    householdDb.removeUserFromHousehold.mockReturnValue(removal.promise);
    householdCache.invalidateHouseholdCacheForUsers.mockResolvedValue(undefined);
    connectionManager.emitConnectionInvalidation.mockResolvedValue(undefined);

    const caller = householdsRouter.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.leave({ householdId: household.id, version: 3 });

    // Success acknowledged while the removal has not settled: cache is still stale,
    // so an immediate client refetch would show pre-leave membership.
    expect(result).toEqual({ success: true });
    expect(householdCache.invalidateHouseholdCacheForUsers).not.toHaveBeenCalled();
    expect(connectionManager.emitConnectionInvalidation).not.toHaveBeenCalled();

    removal.resolve({ stale: false });
    await flushAsync();

    // Eventually the chain completes: cache invalidated for leaver + remaining
    // members, connection terminated, remaining members notified.
    expect(householdCache.invalidateHouseholdCacheForUsers).toHaveBeenCalledWith([
      user.id,
      memberId,
    ]);
    expect(connectionManager.emitConnectionInvalidation).toHaveBeenCalledWith(
      user.id,
      "household-left"
    );
    expect(householdEmitter.emitToUser).toHaveBeenCalledWith(memberId, "userLeft", {
      userId: user.id,
    });
  });

  it("returns success even when the membership write fails, retracting via the failed event", async () => {
    householdDb.removeUserFromHousehold.mockRejectedValue(new Error("connection lost"));

    const caller = householdsRouter.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.leave({ householdId: household.id, version: 3 });

    // The caller was told the leave succeeded although the write failed.
    expect(result).toEqual({ success: true });

    await flushAsync();

    expect(trpcLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: user.id }),
      "Failed to leave household"
    );
    expect(householdEmitter.emitToUser).toHaveBeenCalledWith(user.id, "failed", {
      reason: "Failed to leave household",
    });
    expect(householdCache.invalidateHouseholdCacheForUsers).not.toHaveBeenCalled();
    expect(connectionManager.emitConnectionInvalidation).not.toHaveBeenCalled();
  });
});
