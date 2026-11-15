/** The Pantry field's add rules and the put-on-the-list flow both apps share. */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PantryIngredientDto } from "@norish/shared/contracts";
import { BASE_SPELLING_RULES } from "@norish/shared/lib/spelling-keys";

import { usePantryField } from "../use-pantry-field";
import { usePutOnTheList } from "../use-put-on-the-list";

const mutations = vi.hoisted(() => ({
  add: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../use-pantry-mutations", () => ({
  usePantryMutations: () => ({ addPantryIngredient: mutations.add }),
}));
vi.mock("../use-groceries-mutations", () => ({
  useGroceriesMutations: () => ({
    createGroceriesFromData: mutations.create,
    deleteGroceries: mutations.remove,
  }),
}));

const SALT: PantryIngredientDto = {
  id: "p-salt",
  userId: "u1",
  ingredientId: "i-salt",
  name: "Salt",
  version: 1,
  ancestorIds: [],
  localeNames: {},
};

describe("usePantryField", () => {
  beforeEach(() => {
    mutations.add.mockReset();
  });

  it("cannot add an empty field or a food already kept, but can add another", () => {
    const { result } = renderHook(() => usePantryField([SALT], "en", BASE_SPELLING_RULES));

    expect(result.current.canAdd).toBe(false);
    act(() => result.current.setDraft("salt"));
    expect(result.current.canAdd).toBe(false);
    act(() => result.current.setDraft(" pepper "));
    expect(result.current.canAdd).toBe(true);
    expect(result.current.typed).toBe("pepper");
  });

  it("adds a typed name under its own text and empties the field", () => {
    const { result } = renderHook(() => usePantryField([], "en", BASE_SPELLING_RULES));

    act(() => result.current.setDraft("pepper"));
    act(() => result.current.keep("pepper"));

    expect(mutations.add).toHaveBeenCalledWith("pepper", "pepper");
    expect(result.current.draft).toBe("");
  });

  it("adds a picked food by the name the reader reads it in", () => {
    const { result } = renderHook(() => usePantryField([], "nl", BASE_SPELLING_RULES));
    const food = { ingredientId: "i-onion", name: "onion", localeNames: { nl: "ui" } };

    act(() => result.current.keep(food));

    expect(mutations.add).toHaveBeenCalledWith(food, "ui");
  });
});

describe("usePutOnTheList", () => {
  beforeEach(() => {
    mutations.create.mockReset();
    mutations.remove.mockReset();
  });

  it("creates one grocery named as read, with no amount, and undo deletes it", async () => {
    mutations.create.mockResolvedValue(["g1"]);
    const { result } = renderHook(() => usePutOnTheList("nl"));
    const put = result.current({ name: "onion", localeNames: { nl: "ui" } });

    expect(put.name).toBe("ui");
    expect(mutations.create).toHaveBeenCalledWith([{ name: "ui", amount: null, unit: null }]);

    put.undo();
    await vi.waitFor(() => expect(mutations.remove).toHaveBeenCalledWith(["g1"]));
  });

  it("deletes nothing on undo when the create failed", async () => {
    mutations.create.mockRejectedValue(new Error("offline refused"));
    const { result } = renderHook(() => usePutOnTheList("en"));
    const put = result.current({ name: "salt" });

    put.undo();
    await Promise.resolve();
    await Promise.resolve();

    expect(mutations.remove).not.toHaveBeenCalled();
  });
});
