// @vitest-environment node
/**
 * Filing a grocery name at a Store: the name is resolved to its Ingredient,
 * and the Ingredient is what is filed (ADR-0037). The repository and the
 * resolver are mocked; what is pinned here is who may file where, and what
 * the household hears about it.
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
import { resolveIngredient } from "../mocks/ingredient-resolver";
import { assertHouseholdAccess } from "../mocks/permissions";
import { stores } from "../mocks/realtime/stores";

const aislesRepository = vi.hoisted(() => ({
  fileIngredient: vi.fn(),
  getAisleById: vi.fn(),
  listAisleLinksByStoreIds: vi.fn(),
}));

const storesRepository = vi.hoisted(() => ({
  getStoreOwnerId: vi.fn(),
  listStoresByUserIds: vi.fn(),
}));

vi.mock("@norish/db/repositories/aisles", () => aislesRepository);
vi.mock("@norish/db/repositories/stores", () => storesRepository);
vi.mock("@norish/shared-server/ingredients/resolver", () => import("../mocks/ingredient-resolver"));
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/shared-server/realtime/stores", () => import("../mocks/realtime/stores"));
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
    aislesRepository.fileIngredient.mockImplementation(
      async (storeId: string, ingredientId: string, aisleId: string | null) => ({
        storeId,
        ingredientId,
        aisleId,
      })
    );
  });

  it("files the name under the aisle and tells the household where it now is", async () => {
    const filing = await caller.fileGroceryName({ storeId: STORE, name: "Melk", aisleId: ZUIVEL });

    expect(resolveIngredient).toHaveBeenCalledWith("Melk", { userId: ctx.user.id });
    expect(aislesRepository.fileIngredient).toHaveBeenCalledWith(STORE, "ingredient:melk", ZUIVEL);
    expect(filing).toEqual({ storeId: STORE, ingredientId: "ingredient:melk", aisleId: ZUIVEL });
    expect(stores.publish).toHaveBeenCalledWith(
      "aisleFiled",
      {
        filing: { storeId: STORE, ingredientId: "ingredient:melk", aisleId: ZUIVEL },
      },
      { householdKey: ctx.householdKey }
    );
  });

  it("forgets an Ingredient filed under null, and says so in the same event", async () => {
    await caller.fileGroceryName({ storeId: STORE, name: "melk", aisleId: null });

    expect(aislesRepository.fileIngredient).toHaveBeenCalledWith(STORE, "ingredient:melk", null);
    expect(aislesRepository.getAisleById).not.toHaveBeenCalled();
    expect(stores.publish).toHaveBeenCalledWith(
      "aisleFiled",
      {
        filing: { storeId: STORE, ingredientId: "ingredient:melk", aisleId: null },
      },
      { householdKey: ctx.householdKey }
    );
  });

  it("says the same thing twice when filed twice, so a repeat merges as a no-op", async () => {
    await caller.fileGroceryName({ storeId: STORE, name: "Melk", aisleId: ZUIVEL });
    await caller.fileGroceryName({ storeId: STORE, name: " melk ", aisleId: ZUIVEL });

    const [first, second] = stores.publish.mock.calls.map((call) => call[1]);

    expect(second).toEqual(first);
  });

  it("refuses to file at a Store of another household", async () => {
    assertHouseholdAccess.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));

    await expect(
      caller.fileGroceryName({ storeId: OTHER_STORE, name: "melk", aisleId: ZUIVEL })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(aislesRepository.fileIngredient).not.toHaveBeenCalled();
    expect(stores.publish).not.toHaveBeenCalled();
  });

  it("refuses an aisle that is not the Store's", async () => {
    aislesRepository.getAisleById.mockResolvedValue({
      id: ZUIVEL,
      storeId: OTHER_STORE,
      name: "Zuivel",
    });

    await expect(
      caller.fileGroceryName({ storeId: STORE, name: "melk", aisleId: ZUIVEL })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    aislesRepository.getAisleById.mockResolvedValue(null);
    await expect(
      caller.fileGroceryName({ storeId: STORE, name: "melk", aisleId: ZUIVEL })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(aislesRepository.fileIngredient).not.toHaveBeenCalled();
  });

  it("refuses a name that is punctuation alone, and writes and announces nothing", async () => {
    await expect(
      caller.fileGroceryName({ storeId: STORE, name: "!?", aisleId: ZUIVEL })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(resolveIngredient).not.toHaveBeenCalled();
    expect(aislesRepository.fileIngredient).not.toHaveBeenCalled();
    expect(stores.publish).not.toHaveBeenCalled();
  });

  it("files nothing for a name that is markup alone", async () => {
    await expect(
      caller.fileGroceryName({ storeId: STORE, name: "<b></b>", aisleId: ZUIVEL })
    ).resolves.toBeNull();
    expect(aislesRepository.fileIngredient).not.toHaveBeenCalled();
  });

  it("files every spelling of a food as its one Ingredient", async () => {
    resolveIngredient.mockResolvedValueOnce({
      text: "Uien",
      aliasId: "alias:uien",
      ingredientId: "ingredient:onion",
    });

    await caller.fileGroceryName({ storeId: STORE, name: "Uien", aisleId: ZUIVEL });

    expect(aislesRepository.fileIngredient).toHaveBeenCalledWith(STORE, "ingredient:onion", ZUIVEL);
  });

  it("reads every Aisle Link of the household's Stores in one query", async () => {
    storesRepository.listStoresByUserIds.mockResolvedValue([{ id: STORE }, { id: OTHER_STORE }]);
    aislesRepository.listAisleLinksByStoreIds.mockResolvedValue([
      { storeId: STORE, ingredientId: "ingredient:melk", aisleId: ZUIVEL },
    ]);

    const links = await caller.aisleLinks();

    expect(storesRepository.listStoresByUserIds).toHaveBeenCalledWith(ctx.userIds);
    expect(aislesRepository.listAisleLinksByStoreIds).toHaveBeenCalledWith([STORE, OTHER_STORE]);
    expect(links).toEqual([{ storeId: STORE, ingredientId: "ingredient:melk", aisleId: ZUIVEL }]);
  });
});
