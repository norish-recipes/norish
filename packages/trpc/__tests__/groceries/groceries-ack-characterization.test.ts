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

describe("groceries.update acknowledgement", () => {
  const mockUser = createMockUser();
  const mockHousehold = createMockHousehold();
  let ctx: ReturnType<typeof createMockAuthedContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockAuthedContext(mockUser, mockHousehold);
  });

  it("waits for the authoritative write and reports a stale outcome", async () => {
    const groceryId = crypto.randomUUID();
    const ownerLookup = deferred<Map<string, string>>();

    getGroceryOwnerIds.mockReturnValue(ownerLookup.promise);
    assertHouseholdAccess.mockResolvedValue(undefined);
    updateGroceries.mockResolvedValue([]);

    const caller = groceriesProcedures.createCaller({ ...ctx, multiplexer: null } as any);
    const resultPromise = caller.update({ groceryId, raw: "Oat milk", version: 4 });

    await Promise.resolve();
    expect(updateGroceries).not.toHaveBeenCalled();

    ownerLookup.resolve(new Map([[groceryId, ctx.user.id]]));

    await expect(resultPromise).resolves.toEqual({ success: true, applied: false, stale: true });
    expect(updateGroceries).toHaveBeenCalled();
  });

  it("throws write failures instead of retracting success through a failed event", async () => {
    const groceryId = crypto.randomUUID();

    getGroceryOwnerIds.mockResolvedValue(new Map([[groceryId, ctx.user.id]]));
    assertHouseholdAccess.mockResolvedValue(undefined);
    updateGroceries.mockRejectedValue(new Error("connection lost"));

    const caller = groceriesProcedures.createCaller({ ...ctx, multiplexer: null } as any);
    await expect(caller.update({ groceryId, raw: "Oat milk", version: 4 })).rejects.toThrow(
      "connection lost"
    );

    expect(trpcLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ userId: ctx.user.id, groceryId }),
      "Failed to update grocery"
    );
    expect(groceryEmitter.emitToHousehold).not.toHaveBeenCalledWith(
      ctx.householdKey,
      "failed",
      expect.anything()
    );
  });
});
