// @vitest-environment node
/**
 * Filing a grocery name at a Store. The repository is mocked; what is pinned
 * here is who may file where, and what the household hears about it.
 */
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { aisleProcedures } from "../../src/routers/stores/aisles";
import {
  createMockAuthedContext,
  createMockCallerContext,
  createMockHousehold,
  createMockUser,
} from "../calendar/test-utils";
import { assertHouseholdAccess } from "../mocks/permissions";

const aislesRepository = vi.hoisted(() => ({
  fileName: vi.fn(),
  getAisleById: vi.fn(),
  listAisleLinksByStoreIds: vi.fn(),
}));

const storesRepository = vi.hoisted(() => ({
  getStoreOwnerId: vi.fn(),
  listStoresByUserIds: vi.fn(),
}));

const storeEmitter = vi.hoisted(() => ({ emitToHousehold: vi.fn() }));

vi.mock("@norish/db/repositories/aisles", () => aislesRepository);
vi.mock("@norish/db/repositories/stores", () => storesRepository);
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/trpc/routers/stores/emitter", () => ({ storeEmitter }));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const STORE = "11111111-1111-4111-8111-111111111111";
const OTHER_STORE = "22222222-2222-4222-8222-222222222222";
const ZUIVEL = "33333333-3333-4333-8333-333333333333";

describe("filing a name at a Store", () => {
  const ctx = createMockAuthedContext(createMockUser(), createMockHousehold());
  const caller = aisleProcedures.createCaller(createMockCallerContext(ctx));

  beforeEach(() => {
    vi.clearAllMocks();
    storesRepository.getStoreOwnerId.mockResolvedValue(ctx.user.id);
    assertHouseholdAccess.mockResolvedValue(undefined);
    aislesRepository.getAisleById.mockResolvedValue({ id: ZUIVEL, storeId: STORE, name: "Zuivel" });
    aislesRepository.fileName.mockImplementation(
      async (storeId: string, name: string, aisleId: string | null) => ({
        storeId,
        normalizedName: name.trim().toLowerCase(),
        aisleId,
      })
    );
  });

  it("files the name under the aisle and tells the household where it now is", async () => {
    const filing = await caller.fileName({ storeId: STORE, name: "Melk", aisleId: ZUIVEL });

    expect(aislesRepository.fileName).toHaveBeenCalledWith(STORE, "Melk", ZUIVEL);
    expect(filing).toEqual({ storeId: STORE, normalizedName: "melk", aisleId: ZUIVEL });
    expect(storeEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "aisleFiled", {
      filing: { storeId: STORE, normalizedName: "melk", aisleId: ZUIVEL },
    });
  });

  it("forgets a name filed under null, and says so in the same event", async () => {
    await caller.fileName({ storeId: STORE, name: "melk", aisleId: null });

    expect(aislesRepository.fileName).toHaveBeenCalledWith(STORE, "melk", null);
    expect(aislesRepository.getAisleById).not.toHaveBeenCalled();
    expect(storeEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "aisleFiled", {
      filing: { storeId: STORE, normalizedName: "melk", aisleId: null },
    });
  });

  it("says the same thing twice when filed twice, so a repeat merges as a no-op", async () => {
    await caller.fileName({ storeId: STORE, name: "Melk", aisleId: ZUIVEL });
    await caller.fileName({ storeId: STORE, name: " melk ", aisleId: ZUIVEL });

    const [first, second] = storeEmitter.emitToHousehold.mock.calls.map((call) => call[2]);

    expect(second).toEqual(first);
  });

  it("refuses to file at a Store of another household", async () => {
    assertHouseholdAccess.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));

    await expect(
      caller.fileName({ storeId: OTHER_STORE, name: "melk", aisleId: ZUIVEL })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(aislesRepository.fileName).not.toHaveBeenCalled();
    expect(storeEmitter.emitToHousehold).not.toHaveBeenCalled();
  });

  it("refuses an aisle that is not the Store's", async () => {
    aislesRepository.getAisleById.mockResolvedValue({
      id: ZUIVEL,
      storeId: OTHER_STORE,
      name: "Zuivel",
    });

    await expect(
      caller.fileName({ storeId: STORE, name: "melk", aisleId: ZUIVEL })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    aislesRepository.getAisleById.mockResolvedValue(null);
    await expect(
      caller.fileName({ storeId: STORE, name: "melk", aisleId: ZUIVEL })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(aislesRepository.fileName).not.toHaveBeenCalled();
  });

  it("writes and announces nothing for a name that folds to nothing", async () => {
    aislesRepository.fileName.mockResolvedValue(null);

    await expect(
      caller.fileName({ storeId: STORE, name: "!?", aisleId: ZUIVEL })
    ).resolves.toBeNull();
    expect(storeEmitter.emitToHousehold).not.toHaveBeenCalled();
  });

  it("reads every Aisle Link of the household's Stores in one query", async () => {
    storesRepository.listStoresByUserIds.mockResolvedValue([{ id: STORE }, { id: OTHER_STORE }]);
    aislesRepository.listAisleLinksByStoreIds.mockResolvedValue([
      { storeId: STORE, normalizedName: "melk", aisleId: ZUIVEL },
    ]);

    const links = await caller.aisleLinks();

    expect(storesRepository.listStoresByUserIds).toHaveBeenCalledWith(ctx.userIds);
    expect(aislesRepository.listAisleLinksByStoreIds).toHaveBeenCalledWith([STORE, OTHER_STORE]);
    expect(links).toEqual([{ storeId: STORE, normalizedName: "melk", aisleId: ZUIVEL }]);
  });
});
