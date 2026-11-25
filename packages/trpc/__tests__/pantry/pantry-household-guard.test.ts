// @vitest-environment node
/**
 * Removing a Pantry item through the real household guard: the guard compares the
 * reader's household with the row's own.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { pantryProcedures } from "../../src/routers/pantry/pantry";
import {
  createMockAuthedContext,
  createMockCallerContext,
  createMockHousehold,
  createMockUser,
} from "../calendar/test-utils";

const pantryRepository = vi.hoisted(() => ({
  deletePantryIngredient: vi.fn(),
  getPantryIngredientHouseholdId: vi.fn(),
  listPantryIngredientsByHousehold: vi.fn(),
  listPantrySuggestions: vi.fn(),
}));
vi.mock("@norish/db/repositories/pantry", () => pantryRepository);
vi.mock("@norish/db/repositories/server-config", () => ({ getConfig: vi.fn() }));
vi.mock("@norish/shared-server/ingredients/pantry", () => ({
  addToPantry: vi.fn(),
  addPickedToPantry: vi.fn(),
}));
vi.mock("@norish/shared-server/realtime/pantry", () => import("../mocks/realtime/pantry"));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const OLIVE = "11111111-1111-4111-8111-111111111111";

describe("the Pantry's household guard", () => {
  const ctx = createMockAuthedContext(createMockUser(), createMockHousehold());
  const caller = pantryProcedures.createCaller(createMockCallerContext(ctx));

  beforeEach(() => {
    pantryRepository.deletePantryIngredient.mockResolvedValue(true);
  });

  it("lets a member remove a housemate's item", async () => {
    pantryRepository.getPantryIngredientHouseholdId.mockResolvedValue(ctx.householdId);

    await expect(caller.remove({ id: OLIVE })).resolves.toBe(OLIVE);
    expect(pantryRepository.deletePantryIngredient).toHaveBeenCalledWith(OLIVE, ctx.householdId);
  });

  it("refuses another household's item", async () => {
    pantryRepository.getPantryIngredientHouseholdId.mockResolvedValue("other-household-id");

    await expect(caller.remove({ id: OLIVE })).rejects.toThrow("FORBIDDEN");
    expect(pantryRepository.deletePantryIngredient).not.toHaveBeenCalled();
  });
});
