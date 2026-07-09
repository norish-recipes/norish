// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { trpcLogger } from "@norish/shared-server/logger";

import { groceriesProcedures } from "../../src/routers/groceries/groceries";
import { getGroceryOwnerIds, updateGroceries } from "../mocks/db";
import { groceryEmitter } from "../mocks/grocery-emitter";
import { assertHouseholdAccess } from "../mocks/permissions";
import { createMockAuthedContext, createMockHousehold, createMockUser } from "./test-utils";

const storesRepository = vi.hoisted(() => ({
  findBestIngredientStorePreference: vi.fn(),
  getStoreOwnerId: vi.fn(),
  normalizeIngredientName: vi.fn((name: string) => name.toLowerCase()),
  upsertIngredientStorePreference: vi.fn(),
}));

vi.mock("@norish/db", () => import("../mocks/db"));
vi.mock("@norish/db/repositories/stores", () => storesRepository);
vi.mock(
  "@norish/db/repositories/recurring-groceries",
  () => import("../mocks/recurring-groceries")
);
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/trpc/routers/groceries/emitter", () => import("../mocks/grocery-emitter"));
vi.mock("@norish/shared-server/config/server-config-loader", () => import("../mocks/config"));
vi.mock("@norish/shared/lib/helpers", () => import("../mocks/helpers"));
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
 * `groceries.update` (audit matrix: openspec/changes/make-mutation-acks-truthful).
 *
 * These tests pin today's untruthful behavior as the regression baseline for the
 * conversion. When `groceries.update` is converted to await its write, they should
 * be REWRITTEN to assert the opposite: success only after the write, thrown errors,
 * and no `failed` event.
 */
describe("groceries.update acknowledgement characterization", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockAuthedContext(mockUser, mockHousehold);
  });

  it("returns success before the authoritative write has even started", async () => {
    const groceryId = crypto.randomUUID();
    const ownerLookup = deferred<Map<string, string>>();

    getGroceryOwnerIds.mockReturnValue(ownerLookup.promise);
    assertHouseholdAccess.mockResolvedValue(undefined);
    updateGroceries.mockResolvedValue([]);

    const caller = groceriesProcedures.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.update({ groceryId, raw: "Oat milk", version: 4 });

    // The mutation acknowledged success while the owner lookup is still pending —
    // the DB write has not run yet.
    expect(result).toEqual({ success: true });
    expect(updateGroceries).not.toHaveBeenCalled();

    // Let the floating chain finish so it cannot leak into other tests.
    ownerLookup.resolve(new Map([[groceryId, ctx.user.id]]));
    await flushAsync();
    expect(updateGroceries).toHaveBeenCalled();
  });

  it("returns success even when the write fails, retracting via the failed event", async () => {
    const groceryId = crypto.randomUUID();

    getGroceryOwnerIds.mockResolvedValue(new Map([[groceryId, ctx.user.id]]));
    assertHouseholdAccess.mockResolvedValue(undefined);
    updateGroceries.mockRejectedValue(new Error("connection lost"));

    const caller = groceriesProcedures.createCaller({ ...ctx, multiplexer: null } as any);
    const result = await caller.update({ groceryId, raw: "Oat milk", version: 4 });

    // The caller was told the update succeeded although the write is about to fail.
    expect(result).toEqual({ success: true });

    await flushAsync();

    // The failure only surfaces through the side-channel `failed` event + log.
    expect(trpcLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ctx.user.id, groceryId }),
      "Failed to update grocery"
    );
    expect(groceryEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "failed", {
      reason: expect.any(String),
    });
    expect(groceryEmitter.emitToHousehold).not.toHaveBeenCalledWith(
      ctx.householdKey,
      "updated",
      expect.anything()
    );
  });
});
