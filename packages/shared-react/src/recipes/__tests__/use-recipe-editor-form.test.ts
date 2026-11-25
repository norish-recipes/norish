import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";

import { useRecipeEditorForm } from "../use-recipe-editor-form";

vi.mock("../../config", () => ({
  useUnitsQuery: () => ({ units: {}, isLoading: false }),
}));
const listRead = vi.fn();
const creating = vi.hoisted(() => ({ now: false }));

vi.mock("../../lists", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../lists")>()),
  useListRecipeId: (recipe?: { id: string }) => recipe?.id,
  useEntryCreatePending: () => creating.now,
  useListEntries: (kind: string, recipeId?: string) => {
    listRead(kind, recipeId);

    return {
      entries: [
        { id: "c2", name: "Dinner" },
        { id: "c1", name: "Breakfast" },
      ],
    };
  },
}));
vi.mock("../../reader", () => ({ useDevicePreference: () => ["short"] }));

const at = new Date("2026-05-01T10:00:00.000Z");
const stored: FullRecipeDTO = {
  id: "recipe-1",
  userId: "user-1",
  name: "Soup",
  description: null,
  url: null,
  servings: 2,
  prepMinutes: null,
  cookMinutes: null,
  totalMinutes: null,
  notes: null,
  systemUsed: "metric",
  originalSystem: null,
  calories: null,
  fat: null,
  carbs: null,
  protein: null,
  originCountry: null,
  originCountryName: null,
  originRegion: null,
  provenanceNote: null,
  dishColor: null,
  cuisines: [],
  createdAt: at,
  updatedAt: at,
  categories: ["Soups"],
  version: 3,
  tags: [],
  recipeIngredients: [
    {
      id: "ing-1",
      ingredientId: null,
      ingredientName: "water",
      amount: 1,
      unit: "l",
      order: 0,
      systemUsed: "metric",
      version: 1,
    },
  ],
  steps: [{ step: "Boil.", order: 0, systemUsed: "metric", version: 1 }],
  images: [],
  videos: [],
};

afterEach(() => {
  creating.now = false;
});

describe("useRecipeEditorForm", () => {
  it("seeds an edit's lines and steps and is clean until a field changes", () => {
    const { result } = renderHook(() =>
      useRecipeEditorForm({ mode: "edit", initialData: stored, locale: "en" })
    );

    expect(result.current.isReady).toBe(true);
    expect(result.current.form.ingredients).toHaveLength(1);
    expect(result.current.form.steps).toHaveLength(1);
    expect(result.current.hasUnsavedChanges).toBe(false);

    act(() => result.current.set("notes", "Salt to taste."));
    expect(result.current.hasUnsavedChanges).toBe(true);
  });

  it("offers the recipe's household's Categories and the recipe's own, and adds a picked one", () => {
    const { result } = renderHook(() =>
      useRecipeEditorForm({ mode: "edit", initialData: stored, locale: "en" })
    );

    expect(result.current.categoryOptions).toEqual(["Breakfast", "Dinner", "Soups"]);
    expect(listRead).toHaveBeenCalledWith("category", "recipe-1");
    act(() => result.current.addCategory("Breakfast"));
    expect(result.current.form.categories).toEqual(["Soups", "Breakfast"]);
    act(() => result.current.toggleCategory("Soups"));
    expect(result.current.form.categories).toEqual(["Breakfast"]);
  });

  it("toggles a Category off whatever its case, by the shared fold rule", () => {
    const { result } = renderHook(() =>
      useRecipeEditorForm({ mode: "edit", initialData: stored, locale: "en" })
    );

    act(() => result.current.toggleCategory("soups"));
    expect(result.current.form.categories).toEqual([]);
  });

  it("takes a new recipe's system from its lines until the reader picks one", () => {
    const { result } = renderHook(() => useRecipeEditorForm({ mode: "create", locale: "en" }));
    const cups = { ingredientName: "flour", amount: 2, unit: "cups", order: 0 } as const;

    act(() => result.current.set("ingredients", [{ ...cups, systemUsed: "metric" }]));
    expect(result.current.detectedSystem).toBe("us");
    expect(result.current.form.systemUsed).toBe("us");
    expect(result.current.form.ingredients[0]?.systemUsed).toBe("us");

    act(() => result.current.changeSystem("metric"));
    act(() => result.current.set("ingredients", [{ ...cups, systemUsed: "metric" }]));
    expect(result.current.form.systemUsed).toBe("metric");
  });

  it("moves a step's references with their lines", () => {
    const { result } = renderHook(() => useRecipeEditorForm({ mode: "create", locale: "en" }));

    act(() =>
      result.current.set("steps", [
        {
          step: "Mix",
          order: 0,
          systemUsed: "metric",
          stepIngredients: [{ ingredientOrder: 0, share: 1, order: 0 }],
        },
      ])
    );
    act(() => result.current.moveLines(new Map([[0, 2]])));
    expect(result.current.form.steps[0]?.stepIngredients).toEqual([
      { ingredientOrder: 2, share: 1, order: 0 },
    ]);
  });

  it("refuses to submit an empty form and names what is missing", () => {
    const { result } = renderHook(() => useRecipeEditorForm({ mode: "create", locale: "en" }));
    let payload: unknown;

    act(() => {
      payload = result.current.submit();
    });

    expect(payload).toBeNull();
    expect(result.current.errors).toEqual({
      name: "nameRequired",
      ingredients: "ingredientsRequired",
      steps: "stepsRequired",
    });
  });

  it("saves an edit only once no entry is being created", () => {
    const { result, rerender } = renderHook(() =>
      useRecipeEditorForm({ mode: "edit", initialData: stored, locale: "en" })
    );

    creating.now = true;
    rerender();
    expect(result.current.isCreatingEntry).toBe(true);
    expect(result.current.submit()).toBeNull();
    expect(result.current.errors).toEqual({});

    creating.now = false;
    rerender();
    expect(result.current.submit()).not.toBeNull();
  });

  it("does not add a Category folding like one it has, and names its household's list by the recipe", () => {
    const { result } = renderHook(() =>
      useRecipeEditorForm({ mode: "edit", initialData: stored, locale: "en" })
    );

    act(() => result.current.addCategory("soups"));
    expect(result.current.form.categories).toEqual(["Soups"]);
    expect(result.current.listRecipeId).toBe("recipe-1");
  });
});
