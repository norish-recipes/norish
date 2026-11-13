/** Adding a planned recipe's groceries without showing the panel. */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { PantryIngredientDto } from "@norish/shared/contracts";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { useAddAtOnce } from "../use-add-at-once";

const state = vi.hoisted(() => ({
  pantry: [] as unknown[],
  loading: false,
  fetching: false,
  unavailable: false,
  lines: [] as unknown[],
  create: undefined as unknown as ReturnType<typeof vi.fn>,
}));

vi.mock("../../config", async () => {
  const { spellingRules } = await import("@norish/shared/lib/spelling-keys");
  const units = (await import("@norish/config/units.default.json")).default;

  return { useSpellingRules: () => spellingRules(units as UnitsMap) };
});
vi.mock("../use-groceries-mutations", () => ({
  useGroceriesMutations: () => ({ createGroceriesFromData: state.create }),
}));
vi.mock("../use-pantry-mutations", () => ({
  usePantryMutations: () => ({ addPantryIngredient: vi.fn() }),
}));
vi.mock("../use-pantry-query", () => ({
  usePantryQuery: () => ({
    items: state.pantry,
    isLoading: state.loading,
    isFetching: state.fetching,
    isUnavailable: state.unavailable,
  }),
}));
vi.mock("../../recipes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../recipes")>()),
  useRecipeIngredients: () => ({
    ingredients: state.lines,
    systemUsed: "metric",
    isLoading: false,
  }),
  useLinkedRecipeIngredients: () => ({ ingredients: [], isLoading: false }),
}));

const line = (id: string, name: string, ingredientId: string | null = `i-${name}`) => ({
  id,
  ingredientId,
  ingredientName: name,
  amount: 1,
  unit: null,
  systemUsed: "metric",
  order: 0,
});

const kept = (name: string): PantryIngredientDto => ({
  id: `p-${name}`,
  userId: "u1",
  ingredientId: `i-${name}`,
  name,
  version: 1,
  ancestorIds: [],
  localeNames: {},
});

const addedNames = () =>
  (state.create.mock.calls[0]?.[0] ?? []).map((added: { name: string }) => added.name);

function run(onOpenChange = vi.fn(), onDone = vi.fn()) {
  const wrapper = createTestWrapper(createTestQueryClient());
  const view = renderHook(
    () =>
      useAddAtOnce({
        recipeId: "r1",
        initialServings: 1,
        originalServings: 1,
        onOpenChange,
        onDone,
      }),
    { wrapper }
  );

  return { ...view, onOpenChange, onDone };
}

describe("useAddAtOnce", () => {
  beforeEach(() => {
    state.create = vi.fn(async () => undefined);
    state.pantry = [kept("olive oil"), kept("salt")];
    state.loading = false;
    state.fetching = false;
    state.unavailable = false;
    state.lines = [
      line("l-oil", "olive oil"),
      line("l-chicken", "chicken breast"),
      line("l-salt", "salt"),
    ];
  });

  it("adds what is to buy, then closes", async () => {
    let view!: ReturnType<typeof run>;

    await act(async () => {
      view = run();
    });

    expect(addedNames()).toEqual(["chicken breast"]);
    expect(view.onDone).toHaveBeenCalledTimes(1);
    expect(view.onOpenChange).toHaveBeenCalledWith(false);
    expect(view.onOpenChange).not.toHaveBeenCalledWith(true);
  });

  it("waits for the Pantry before deciding what to buy", async () => {
    state.loading = true;
    const { rerender, onOpenChange } = run();

    expect(state.create).not.toHaveBeenCalled();

    state.loading = false;
    await act(async () => rerender());

    expect(state.create).toHaveBeenCalledTimes(1);
    expect(addedNames()).toEqual(["chicken breast"]);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("decides from the Pantry read again, not from a cached copy", async () => {
    // The cached copy predates a housemate keeping the chicken breast.
    state.fetching = true;
    const { rerender, onOpenChange } = run();

    await act(async () => {});
    expect(state.create).not.toHaveBeenCalled();

    state.pantry = [...state.pantry, kept("chicken breast")];
    state.fetching = false;
    await act(async () => rerender());

    expect(state.create).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens the panel instead when the Pantry cannot be read", async () => {
    state.pantry = [];
    state.unavailable = true;
    let view!: ReturnType<typeof run>;

    await act(async () => {
      view = run();
    });

    expect(state.create).not.toHaveBeenCalled();
    expect(view.onOpenChange).toHaveBeenCalledWith(true);
  });

  it("decides once, whatever the Pantry says afterwards", async () => {
    state.unavailable = true;
    const { rerender } = run();

    await act(async () => {});
    state.unavailable = false;
    await act(async () => rerender());
    await act(async () => rerender());

    expect(state.create).not.toHaveBeenCalled();
  });

  it("leaves a line that names no food off the list, such as a tool", async () => {
    state.lines = [...(state.lines as object[]), line("l-tin", "springvorm (26 cm)", null)];

    await act(async () => {
      run();
    });

    expect(addedNames()).toEqual(["chicken breast"]);
  });

  it("adds nothing, and closes, when the Pantry holds every line", async () => {
    state.pantry = [kept("olive oil"), kept("chicken breast"), kept("salt")];
    let view!: ReturnType<typeof run>;

    await act(async () => {
      view = run();
    });

    expect(state.create).not.toHaveBeenCalled();
    expect(view.onOpenChange).toHaveBeenCalledWith(false);
  });
});
