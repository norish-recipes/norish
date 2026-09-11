// @vitest-environment node
/**
 * The Pantry's procedures. The repository is mocked; what is pinned here is
 * who may add and remove, when nothing is written, and what the household
 * hears about it.
 */
import { TRPCError } from "@trpc/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pantryProcedures } from "../../src/routers/pantry/pantry";
import {
  createMockAuthedContext,
  createMockCallerContext,
  createMockHousehold,
  createMockUser,
} from "../calendar/test-utils";
import { assertHouseholdAccess } from "../mocks/permissions";

const pantryRepository = vi.hoisted(() => ({
  createPantryIngredient: vi.fn(),
  deletePantryIngredient: vi.fn(),
  findPantryIngredientInHousehold: vi.fn(),
  getPantryIngredientOwnerId: vi.fn(),
  listPantryIngredientsByUserIds: vi.fn(),
}));

const pantryEmitter = vi.hoisted(() => ({ emitToHousehold: vi.fn() }));

vi.mock("@norish/db/repositories/pantry", () => pantryRepository);
vi.mock("@norish/auth/permissions", () => import("../mocks/permissions"));
vi.mock("@norish/trpc/routers/pantry/emitter", () => ({ pantryEmitter }));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const OLIVE = "11111111-1111-4111-8111-111111111111";
const EXISTING = "22222222-2222-4222-8222-222222222222";

describe("the Pantry", () => {
  const ctx = createMockAuthedContext(createMockUser(), createMockHousehold());
  const caller = pantryProcedures.createCaller(createMockCallerContext(ctx));

  beforeEach(() => {
    vi.clearAllMocks();
    assertHouseholdAccess.mockResolvedValue(undefined);
    pantryRepository.findPantryIngredientInHousehold.mockResolvedValue(null);
    pantryRepository.createPantryIngredient.mockImplementation(
      async (id: string, input: { userId: string; name: string }) => ({
        id,
        userId: input.userId,
        name: input.name.trim(),
        normalizedName: input.name.trim().toLowerCase(),
        version: 1,
      })
    );
    pantryRepository.getPantryIngredientOwnerId.mockResolvedValue(ctx.user.id);
    pantryRepository.deletePantryIngredient.mockResolvedValue(true);
  });

  it("reads the whole household's Pantry", async () => {
    pantryRepository.listPantryIngredientsByUserIds.mockResolvedValue([{ id: OLIVE }]);

    await expect(caller.list()).resolves.toEqual([{ id: OLIVE }]);
    expect(pantryRepository.listPantryIngredientsByUserIds).toHaveBeenCalledWith(ctx.userIds);
  });

  it("adds a name under the client's id and tells the household", async () => {
    await expect(caller.add({ id: OLIVE, name: "Olive Oil" })).resolves.toBe(OLIVE);

    expect(pantryRepository.findPantryIngredientInHousehold).toHaveBeenCalledWith(
      ctx.userIds,
      "olive oil"
    );
    expect(pantryRepository.createPantryIngredient).toHaveBeenCalledWith(OLIVE, {
      userId: ctx.user.id,
      name: "Olive Oil",
    });
    expect(pantryEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "added", {
      item: expect.objectContaining({ id: OLIVE, name: "Olive Oil" }),
    });
  });

  it("mints an id when the client sent none", async () => {
    const id = await caller.add({ name: "Salt" });

    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(pantryRepository.createPantryIngredient).toHaveBeenCalledWith(id, expect.anything());
  });

  it("answers with the item the household already has, writing and announcing nothing", async () => {
    pantryRepository.findPantryIngredientInHousehold.mockResolvedValue({ id: EXISTING });

    await expect(caller.add({ id: OLIVE, name: " olive  OIL! " })).resolves.toBe(EXISTING);
    expect(pantryRepository.createPantryIngredient).not.toHaveBeenCalled();
    expect(pantryEmitter.emitToHousehold).not.toHaveBeenCalled();
  });

  it("refuses a name that folds to nothing", async () => {
    await expect(caller.add({ name: "!?" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(pantryRepository.createPantryIngredient).not.toHaveBeenCalled();
  });

  it("removes an item and tells the household which", async () => {
    await expect(caller.remove({ id: OLIVE })).resolves.toBe(OLIVE);

    expect(assertHouseholdAccess).toHaveBeenCalledWith(ctx.user.id, ctx.user.id);
    expect(pantryRepository.deletePantryIngredient).toHaveBeenCalledWith(OLIVE);
    expect(pantryEmitter.emitToHousehold).toHaveBeenCalledWith(ctx.householdKey, "removed", {
      itemId: OLIVE,
    });
  });

  it("announces nothing for an item already gone", async () => {
    pantryRepository.deletePantryIngredient.mockResolvedValue(false);

    await caller.remove({ id: OLIVE });
    expect(pantryEmitter.emitToHousehold).not.toHaveBeenCalled();
  });

  it("refuses to remove another household's item, or one that does not exist", async () => {
    assertHouseholdAccess.mockRejectedValue(new TRPCError({ code: "FORBIDDEN" }));
    await expect(caller.remove({ id: OLIVE })).rejects.toMatchObject({ code: "FORBIDDEN" });

    pantryRepository.getPantryIngredientOwnerId.mockResolvedValue(null);
    await expect(caller.remove({ id: OLIVE })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(pantryRepository.deletePantryIngredient).not.toHaveBeenCalled();
    expect(pantryEmitter.emitToHousehold).not.toHaveBeenCalled();
  });
});
