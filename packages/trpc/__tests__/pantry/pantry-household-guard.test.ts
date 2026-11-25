// @vitest-environment node
/**
 * Removing a Pantry item through the real household guard: only membership
 * is stubbed, so the guard must be handed the reader's household id.
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
  getPantryIngredientOwnerId: vi.fn(),
  listPantryIngredientsByUserIds: vi.fn(),
  listPantrySuggestions: vi.fn(),
}));
const MEMBERS = vi.hoisted<Record<string, string[]>>(() => ({
  "test-household-id": ["test-user-id", "household-member-id"],
  "other-household-id": ["stranger-id"],
}));

vi.mock("@norish/db/repositories/pantry", () => pantryRepository);
vi.mock("@norish/db/repositories/households", () => ({
  isHouseholdMember: vi.fn(async (householdId: string, userId: string) =>
    (MEMBERS[householdId] ?? []).includes(userId)
  ),
}));
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
    pantryRepository.getPantryIngredientOwnerId.mockResolvedValue("household-member-id");

    await expect(caller.remove({ id: OLIVE })).resolves.toBe(OLIVE);
    expect(pantryRepository.deletePantryIngredient).toHaveBeenCalledWith(OLIVE);
  });

  it("refuses another household's item", async () => {
    pantryRepository.getPantryIngredientOwnerId.mockResolvedValue("stranger-id");

    await expect(caller.remove({ id: OLIVE })).rejects.toThrow("FORBIDDEN");
    expect(pantryRepository.deletePantryIngredient).not.toHaveBeenCalled();
  });
});
