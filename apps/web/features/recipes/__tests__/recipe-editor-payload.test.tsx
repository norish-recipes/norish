import { readAnswers, sentReads } from "@/__tests__/helpers/trpc-fake";
import { RecipeEditorScreen } from "@/features/recipes/recipe-editor-screen";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";
import { RecipeChangedElsewhereError } from "@norish/shared-react/recipes";

const mocks = vi.hoisted(() => ({ createRecipe: vi.fn(), updateRecipe: vi.fn(), push: vi.fn() }));

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, back: vi.fn() }),
}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
vi.mock("@norish/shared-react/config", () => ({
  useIngredientsSubscription: () => undefined,
  useUnitsQuery: () => ({ units: {}, isLoading: false }),
  useCategoriesQuery: () => ({ categories: [], builtInAliases: {}, isLoading: false }),
}));
vi.mock("@norish/shared-react/reader", async () =>
  (await import("@/__tests__/helpers/reader-mock")).mockDevicePreferences()
);
vi.mock("@/hooks/use-recipes-mutations", () => ({
  useRecipesMutations: () => ({
    createRecipe: mocks.createRecipe,
    updateRecipe: mocks.updateRecipe,
  }),
}));
// The rows only report edits, so an untouched recipe saves what the screen seeded.
vi.mock("@/features/recipes/components/editor/ingredient-input", () => ({ default: () => null }));
vi.mock("@/features/recipes/components/editor/step-input", () => ({ default: () => null }));
vi.mock("@/features/recipes/components/editor/media-gallery-input", () => ({
  default: () => null,
}));
vi.mock("@/features/recipes/components/editor/measurement-system-selector", () => ({
  default: () => null,
}));
vi.mock("@/features/recipes/components/editor/time-inputs", () => ({ default: () => null }));
vi.mock("@/features/recipes/components/editor/smart-input-help", () => ({ default: () => null }));
vi.mock("@/features/recipes/components/editor/smart-text-input", () => ({ default: () => null }));
vi.mock("@/components/shared/tag-input", () => ({ default: () => null }));
vi.mock("@/features/recipes/components/editor/provenance-fields", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  default: () => null,
}));

const at = new Date("2026-05-01T10:00:00.000Z");

/** A recipe with sections, `@` references, step photos, notes, media and a second system. */
const stored: FullRecipeDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  householdId: "household-1",
  name: "Hoisin chicken",
  description: "Sticky and quick.",
  url: "https://example.com/hoisin",
  servings: 4,
  prepMinutes: 15,
  cookMinutes: 15,
  totalMinutes: 30,
  notes: "Thighs stay juicier.",
  systemUsed: "metric",
  originalSystem: "metric",
  calories: 238,
  fat: "9",
  carbs: "14.5",
  protein: "24",
  originCountry: "CN",
  originCountryName: "China",
  originRegion: "Guangdong",
  provenanceNote: "Cantonese roots.",
  dishColor: null,
  cuisines: [{ id: "cuisine-1", name: "Cantonese", version: 1 }],
  createdAt: at,
  updatedAt: at,
  categories: ["Dinner"],
  version: 7,
  tags: [
    { name: "quick", version: 1 },
    { name: "chicken", version: 2 },
  ],
  recipeIngredients: [
    {
      id: "ing-1",
      ingredientId: "food-1",
      ingredientName: "green onions",
      amount: 3,
      unit: null,
      order: 0,
      systemUsed: "metric",
      version: 2,
    },
    {
      id: "ing-2",
      ingredientId: null,
      ingredientName: "# For the sauce",
      amount: null,
      unit: null,
      order: 1,
      systemUsed: "metric",
      version: 1,
    },
    {
      id: "ing-3",
      ingredientId: "food-2",
      ingredientName: "hoisin sauce",
      amount: 45,
      unit: "ml",
      order: 2,
      systemUsed: "metric",
      version: 3,
    },
    {
      id: "ing-us",
      ingredientId: "food-2",
      ingredientName: "hoisin sauce",
      amount: 3,
      unit: "tbsp",
      order: 0,
      systemUsed: "us",
      version: 1,
    },
  ],
  steps: [
    {
      step: "# Prep",
      order: 0,
      systemUsed: "metric",
      version: 1,
      images: [],
      stepIngredients: [],
    },
    {
      step: "Slice the green onions and stir in the hoisin sauce.",
      order: 1,
      systemUsed: "metric",
      version: 4,
      images: [{ id: "step-img-1", image: "/recipes/r/steps/a.jpg", order: 0, version: 1 }],
      stepIngredients: [
        { ingredientOrder: 2, share: 0.5, order: 0 },
        { ingredientOrder: 0, share: 1, order: 1 },
      ],
    },
    {
      step: "Stir in the hoisin sauce.",
      order: 0,
      systemUsed: "us",
      version: 1,
      images: [],
      stepIngredients: [],
    },
  ],
  images: [
    { id: "img-2", image: "/recipes/r/b.jpg", order: 1, generated: false, version: 1 },
    { id: "img-1", image: "/recipes/r/a.jpg", order: 0, generated: false, version: 3 },
  ],
  videos: [
    {
      id: "vid-1",
      video: "/recipes/r/v.mp4",
      thumbnail: "/recipes/r/v.jpg",
      duration: 24,
      order: 2,
      version: 1,
    },
  ],
};

beforeEach(() => {
  mocks.updateRecipe.mockReset();
  mocks.push.mockReset();
  readAnswers.clear();
  sentReads.mockClear();
});

describe("RecipeEditorScreen save of an untouched recipe", () => {
  // Its untouched clearable fields and lists are left out, so a change made meanwhile elsewhere stays.
  it("sends exactly what it was given, active system only", async () => {
    render(<RecipeEditorScreen initialData={stored} mode="edit" />, {
      wrapper: createTestWrapper(createTestQueryClient()),
    });

    fireEvent.click(screen.getByRole("button", { name: "saveChanges" }));

    await waitFor(() => expect(mocks.updateRecipe).toHaveBeenCalledTimes(1));
    expect(mocks.updateRecipe.mock.calls[0]?.slice(0, 2)).toStrictEqual([
      stored.id,
      {
        name: "Hoisin chicken",
        servings: 4,
        systemUsed: "metric",
        recipeIngredients: [
          {
            id: "ing-1",
            version: 2,
            ingredientName: "green onions",
            ingredientId: null,
            amount: 3,
            unit: null,
            order: 0,
            systemUsed: "metric",
          },
          {
            id: "ing-2",
            version: 1,
            ingredientName: "# For the sauce",
            ingredientId: null,
            amount: null,
            unit: null,
            order: 1,
            systemUsed: "metric",
          },
          {
            id: "ing-3",
            version: 3,
            ingredientName: "hoisin sauce",
            ingredientId: null,
            amount: 45,
            unit: "ml",
            order: 2,
            systemUsed: "metric",
          },
        ],
        steps: [
          {
            step: "# Prep",
            order: 0,
            systemUsed: "metric",
            version: 1,
            images: [],
            stepIngredients: [],
          },
          {
            step: "Slice the green onions and stir in the hoisin sauce.",
            order: 1,
            systemUsed: "metric",
            version: 4,
            images: [{ id: "step-img-1", image: "/recipes/r/steps/a.jpg", order: 0, version: 1 }],
            stepIngredients: [
              { ingredientOrder: 2, share: 0.5, order: 0 },
              { ingredientOrder: 0, share: 1, order: 1 },
            ],
          },
        ],
        images: [
          { id: "img-1", image: "/recipes/r/a.jpg", order: 0, version: 3 },
          { id: "img-2", image: "/recipes/r/b.jpg", order: 1, version: 1 },
        ],
        videos: [
          {
            id: "vid-1",
            video: "/recipes/r/v.mp4",
            thumbnail: "/recipes/r/v.jpg",
            duration: 24,
            order: 2,
            version: 1,
          },
        ],
        version: 7,
      },
    ]);
  });
});

describe("RecipeEditorScreen save that fails", () => {
  const saveChanges = () => {
    render(<RecipeEditorScreen initialData={stored} mode="edit" />, {
      wrapper: createTestWrapper(createTestQueryClient()),
    });
    fireEvent.click(screen.getByRole("button", { name: "saveChanges" }));
  };

  it("shows the error and keeps the form open", async () => {
    mocks.updateRecipe.mockImplementation((_id, _input, after) =>
      after.onFailed(new Error("You do not have permission to access this recipe"))
    );
    saveChanges();

    expect(
      await screen.findByText("You do not have permission to access this recipe")
    ).toBeTruthy();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("opens the recipe once the save is stored", async () => {
    mocks.updateRecipe.mockImplementation((_id, _input, after) => after.onSaved());
    saveChanges();

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/recipes/${stored.id}`));
  });

  it("takes no input while the save is in flight", async () => {
    mocks.updateRecipe.mockImplementation(() => {});
    saveChanges();

    await waitFor(() => expect(mocks.updateRecipe).toHaveBeenCalledTimes(1));
    expect(document.querySelector("form")).toHaveAttribute("inert");
    fireEvent.click(screen.getByRole("button", { name: "saveChanges", hidden: true }));
    expect(mocks.updateRecipe).toHaveBeenCalledTimes(1);
  });

  it("saves again at the fresh recipe's version after a stale answer", async () => {
    readAnswers.set("recipes.get", async () => ({ ...stored, version: 9 }));
    mocks.updateRecipe.mockImplementationOnce((_id, _input, after) =>
      after.onFailed(new RecipeChangedElsewhereError())
    );
    saveChanges();

    expect(await screen.findByText("common.changedElsewhere.title")).toBeTruthy();
    await waitFor(() => expect(document.querySelector("form")).not.toHaveAttribute("inert"));
    await waitFor(() => expect(sentReads).toHaveBeenCalledWith("recipes.get", { id: stored.id }));
    fireEvent.click(screen.getByRole("button", { name: "saveChanges" }));

    await waitFor(() => expect(mocks.updateRecipe).toHaveBeenCalledTimes(2));
    expect(mocks.updateRecipe.mock.calls[1]?.[1]).toMatchObject({ version: 9 });
  });
});
