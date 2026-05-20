import type { ParsedIngredient } from "@/components/recipes/ingredient-input";
import type { RecipeGalleryMedia } from "@/components/recipes/media-gallery-input";
import type { Step } from "@/components/recipes/step-input";
import { useRecipeFormDirtyState } from "@/app/(app)/recipes/edit/components/use-recipe-form-dirty-state";
import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { UnitsMap } from "@norish/config/zod/server-config";
import type { FullRecipeDTO, MeasurementSystem, RecipeCategory } from "@norish/shared/contracts";

interface RecipeFormState {
  name: string;
  description: string;
  notes: string;
  url: string;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  tags: string[];
  categories: RecipeCategory[];
  ingredients: ParsedIngredient[];
  steps: Step[];
  systemUsed: MeasurementSystem;
  media: RecipeGalleryMedia[];
  calories: number | null;
  fat: number | null;
  carbs: number | null;
  protein: number | null;
}

const units = {} satisfies UnitsMap;

const baseRecipe: FullRecipeDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  name: "Chocolate Cake",
  description: "Rich and simple",
  image: "/recipes/cake-primary.jpg",
  url: "https://example.com/cake",
  servings: 8,
  prepMinutes: 20,
  cookMinutes: 35,
  totalMinutes: 55,
  notes: "Cool fully before slicing",
  systemUsed: "metric",
  calories: 420,
  fat: "12.5",
  carbs: "60",
  protein: "8",
  createdAt: new Date("2026-05-01T10:00:00.000Z"),
  updatedAt: new Date("2026-05-01T10:00:00.000Z"),
  categories: ["Dinner"],
  version: 3,
  recipeIngredients: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      ingredientId: null,
      ingredientName: "Flour",
      amount: 200,
      unit: "g",
      order: 0,
      systemUsed: "metric",
      version: 1,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      ingredientId: null,
      ingredientName: "Flour",
      amount: 7,
      unit: "oz",
      order: 0,
      systemUsed: "us",
      version: 1,
    },
  ],
  steps: [
    {
      step: "Mix ingredients",
      systemUsed: "metric",
      order: 0,
      version: 1,
      images: [{ id: "step-img-1", image: "/steps/mix.jpg", order: 0, version: 1 }],
    },
    {
      step: "Mix ingredients",
      systemUsed: "us",
      order: 0,
      version: 1,
      images: [],
    },
  ],
  tags: [{ name: "dessert" }, { name: "baking" }],
  author: undefined,
  images: [
    {
      id: "image-1",
      image: "/recipes/cake-primary.jpg",
      order: 0,
      version: 1,
    },
    {
      id: "image-2",
      image: "/recipes/cake-slice.jpg",
      order: 1,
      version: 1,
    },
  ],
  videos: [
    {
      id: "video-1",
      video: "/recipes/cake.mp4",
      thumbnail: "/recipes/cake-thumb.jpg",
      duration: 120,
      order: 2,
      version: 1,
    },
  ],
};

function createInitialCurrent(overrides: Partial<RecipeFormState> = {}): RecipeFormState {
  return {
    name: "Chocolate Cake",
    description: "Rich and simple",
    notes: "Cool fully before slicing",
    url: "https://example.com/cake",
    servings: 8,
    prepMinutes: 20,
    cookMinutes: 35,
    totalMinutes: 55,
    tags: ["dessert", "baking"],
    categories: ["Dinner"],
    ingredients: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        version: 1,
        ingredientName: "Flour",
        amount: 200,
        unit: "g",
        order: 0,
        systemUsed: "metric",
      },
    ],
    steps: [
      {
        step: "Mix ingredients",
        systemUsed: "metric",
        order: 0,
        version: 1,
        images: [{ id: "step-img-1", image: "/steps/mix.jpg", order: 0, version: 1 }],
      },
    ],
    systemUsed: "metric",
    media: [
      {
        id: "image-1",
        type: "image",
        src: "/recipes/cake-primary.jpg",
        order: 0,
        version: 1,
      },
      {
        id: "image-2",
        type: "image",
        src: "/recipes/cake-slice.jpg",
        order: 1,
        version: 1,
      },
      {
        id: "video-1",
        type: "video",
        src: "/recipes/cake.mp4",
        thumbnail: "/recipes/cake-thumb.jpg",
        duration: 120,
        order: 2,
        version: 1,
      },
    ],
    calories: 420,
    fat: 12.5,
    carbs: 60,
    protein: 8,
    ...overrides,
  };
}

function renderDirtyState(options: {
  current: RecipeFormState;
  initialData?: FullRecipeDTO;
  initializedRecipeId?: string | null;
  mode?: "create" | "edit";
}) {
  return renderHook(() =>
    useRecipeFormDirtyState({
      current: options.current,
      initialData: options.initialData,
      initializedRecipeId:
        options.initializedRecipeId === undefined ? baseRecipe.id : options.initializedRecipeId,
      locale: "en",
      mode: options.mode ?? "edit",
      units,
    })
  );
}

describe("useRecipeFormDirtyState", () => {
  it("returns false for an unchanged initialized edit form", () => {
    const { result } = renderDirtyState({
      current: createInitialCurrent(),
      initialData: baseRecipe,
    });

    expect(result.current).toBe(false);
  });

  it("does not report dirty before edit ingredients and steps have been initialized", () => {
    const { result } = renderDirtyState({
      current: createInitialCurrent({ name: "" }),
      initialData: baseRecipe,
      initializedRecipeId: null,
    });

    expect(result.current).toBe(false);
  });

  it("reports text field changes", () => {
    const { result } = renderDirtyState({
      current: createInitialCurrent({ name: "Chocolate Layer Cake" }),
      initialData: baseRecipe,
    });

    expect(result.current).toBe(true);
  });

  it("reports ingredient changes", () => {
    const { result } = renderDirtyState({
      current: createInitialCurrent({
        ingredients: [
          {
            id: "22222222-2222-4222-8222-222222222222",
            version: 1,
            ingredientName: "Cake flour",
            amount: 200,
            unit: "g",
            order: 0,
            systemUsed: "metric",
          },
        ],
      }),
      initialData: baseRecipe,
    });

    expect(result.current).toBe(true);
  });

  it("reports instruction image changes", () => {
    const { result } = renderDirtyState({
      current: createInitialCurrent({
        steps: [
          {
            step: "Mix ingredients",
            systemUsed: "metric",
            order: 0,
            version: 1,
            images: [],
          },
        ],
      }),
      initialData: baseRecipe,
    });

    expect(result.current).toBe(true);
  });

  it("reports media gallery reorder changes", () => {
    const current = createInitialCurrent();

    const { result } = renderDirtyState({
      current: {
        ...current,
        media: [current.media[1], current.media[0], current.media[2]],
      },
      initialData: baseRecipe,
    });

    expect(result.current).toBe(true);
  });

  it("reports tag, category, timing, and nutrition changes", () => {
    const { result } = renderDirtyState({
      current: createInitialCurrent({
        tags: ["dessert", "baking", "party"],
        categories: ["Dinner", "Snack"],
        prepMinutes: 25,
        fat: 13,
      }),
      initialData: baseRecipe,
    });

    expect(result.current).toBe(true);
  });

  it("uses only the recipe active measurement system as the edit baseline", () => {
    const { result } = renderDirtyState({
      current: createInitialCurrent(),
      initialData: baseRecipe,
    });

    expect(result.current).toBe(false);
  });

  it("reports dirty when the active measurement system changes", () => {
    const { result } = renderDirtyState({
      current: createInitialCurrent({
        systemUsed: "us",
        ingredients: [
          {
            id: "33333333-3333-4333-8333-333333333333",
            version: 1,
            ingredientName: "Flour",
            amount: 7,
            unit: "oz",
            order: 0,
            systemUsed: "us",
          },
        ],
        steps: [
          {
            step: "Mix ingredients",
            systemUsed: "us",
            order: 0,
            version: 1,
            images: [],
          },
        ],
      }),
      initialData: baseRecipe,
    });

    expect(result.current).toBe(true);
  });

  it("treats a create form with empty defaults as clean", () => {
    const { result } = renderDirtyState({
      current: {
        name: "",
        description: "",
        notes: "",
        url: "",
        servings: 1,
        prepMinutes: null,
        cookMinutes: null,
        totalMinutes: null,
        tags: [],
        categories: [],
        ingredients: [],
        steps: [],
        systemUsed: "metric",
        media: [],
        calories: null,
        fat: null,
        carbs: null,
        protein: null,
      },
      initialData: undefined,
      initializedRecipeId: null,
      mode: "create",
    });

    expect(result.current).toBe(false);
  });

  it("reports a create form as dirty after input", () => {
    const { result } = renderDirtyState({
      current: {
        name: "New Recipe",
        description: "",
        notes: "",
        url: "",
        servings: 1,
        prepMinutes: null,
        cookMinutes: null,
        totalMinutes: null,
        tags: [],
        categories: [],
        ingredients: [],
        steps: [],
        systemUsed: "metric",
        media: [],
        calories: null,
        fat: null,
        carbs: null,
        protein: null,
      },
      initialData: undefined,
      initializedRecipeId: null,
      mode: "create",
    });

    expect(result.current).toBe(true);
  });
});
