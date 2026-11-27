import type { ReactNode } from "react";
import { RecipeEditorScreen } from "@/features/recipes/recipe-editor-screen";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

const mocks = vi.hoisted(() => ({
  createRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  push: vi.fn(),
  /** Each reorderable list's reorder, by the key prefix of its rows. */
  reorders: new Map<string, { values: { id: string }[]; onReorder: (rows: unknown[]) => void }>(),
}));

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
// The real ingredient and step rows; only the drag library is a plain list.
vi.mock("motion/react", () => ({
  Reorder: {
    Group: ({
      children,
      values,
      onReorder,
    }: {
      children?: ReactNode;
      values: { id: string }[];
      onReorder: (rows: unknown[]) => void;
    }) => {
      mocks.reorders.set(values[0]?.id.split("-")[0] ?? "", { values, onReorder });

      return <ul>{children}</ul>;
    },
    Item: ({ children }: { children?: ReactNode }) => <li>{children}</li>,
  },
  useDragControls: () => ({ start: vi.fn() }),
}));
vi.mock("@/features/recipes/hooks/use-recipe-images", () => ({
  useRecipeImages: () => ({ uploadStepImage: vi.fn(), deleteStepImage: vi.fn() }),
}));
vi.mock("@/components/ingredients/ingredient-icon", () => ({ IngredientIcon: () => null }));
vi.mock("@norish/shared-react/ingredients", () => ({
  useFoodsByName: () => new Map(),
  useIngredientIcons: () => undefined,
}));
vi.mock("@norish/shared-react/recipes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/recipes")>()),
  useRecipeAutocomplete: () => ({ suggestions: [], isLoading: false }),
}));
vi.mock("@/features/recipes/components/editor/media-gallery-input", () => ({
  default: () => null,
}));
vi.mock("@/features/recipes/components/editor/measurement-system-selector", () => ({
  default: () => null,
}));
vi.mock("@/features/recipes/components/editor/time-inputs", () => ({ default: () => null }));
vi.mock("@/features/recipes/components/editor/smart-input-help", () => ({ default: () => null }));
vi.mock("@/components/shared/tag-input", () => ({ default: () => null }));
vi.mock("@/features/recipes/components/editor/provenance-fields", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  default: () => null,
}));

const at = new Date("2026-05-01T10:00:00.000Z");
const line = (
  id: string,
  ingredientName: string,
  amount: number | null,
  unit: string | null,
  order: number
): FullRecipeDTO["recipeIngredients"][number] => ({
  id,
  ingredientId: null,
  ingredientName,
  amount,
  unit,
  order,
  systemUsed: "metric",
  version: 2,
});

/** Sections, `@` references, a line used twice, one that reparses differently, photos, notes. */
const stored: FullRecipeDTO = {
  id: "11111111-1111-4111-8111-111111111111",
  userId: "user-1",
  householdId: "household-1",
  name: "Hoisin chicken",
  description: null,
  url: null,
  servings: 4,
  prepMinutes: null,
  cookMinutes: null,
  totalMinutes: null,
  notes: "Thighs stay juicier.",
  systemUsed: "metric",
  originalSystem: "metric",
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
  categories: [],
  version: 7,
  tags: [],
  recipeIngredients: [
    line("ing-1", "# For the sauce", null, null, 0),
    line("ing-2", "salt", null, null, 1),
    line("ing-3", "hoisin sauce", 45, "ml", 2),
    line("ing-4", "salt", null, null, 3),
    // Read back, "1 1/2 lemon" would be one and a half lemons.
    line("ing-5", "1/2 lemon", 1, null, 4),
  ],
  steps: [
    { step: "# Prep", order: 0, systemUsed: "metric", version: 1, images: [], stepIngredients: [] },
    {
      step: "Stir in the hoisin sauce and the salt.",
      order: 1,
      systemUsed: "metric",
      version: 4,
      images: [{ id: "step-img-1", image: "/recipes/r/steps/a.jpg", order: 0, version: 1 }],
      stepIngredients: [
        { ingredientOrder: 2, share: 0.5, order: 0 },
        { ingredientOrder: 3, share: 1, order: 1 },
      ],
    },
    {
      step: "Squeeze the lemon over.",
      order: 2,
      systemUsed: "metric",
      version: 1,
      images: [],
      stepIngredients: [{ ingredientOrder: 4, share: 1, order: 0 }],
    },
  ],
  images: [],
  videos: [],
};

type Payload = {
  recipeIngredients: { id?: string; order: number }[];
  steps: { stepIngredients: { ingredientOrder: number }[] }[];
};

const open = () =>
  render(<RecipeEditorScreen initialData={stored} mode="edit" />, {
    wrapper: createTestWrapper(createTestQueryClient()),
  });
const save = async () => {
  fireEvent.click(screen.getByRole("button", { name: "saveChanges" }));
  await waitFor(() => expect(mocks.updateRecipe).toHaveBeenCalledTimes(1));

  return mocks.updateRecipe.mock.calls[0]?.[1] as Payload;
};
/** Which line, by id, each step's references point at in the payload. */
const refIds = (payload: Payload) =>
  payload.steps.map((step) =>
    step.stepIngredients.map(
      (ref) => payload.recipeIngredients.find((ing) => ing.order === ref.ingredientOrder)?.id
    )
  );

beforeEach(() => {
  mocks.updateRecipe.mockReset();
  mocks.reorders.clear();
});

describe("RecipeEditorScreen save through its real rows", () => {
  it("saves an untouched recipe as it was loaded, after every field was visited", async () => {
    open();
    for (const field of screen.getAllByRole("textbox")) {
      fireEvent.focus(field);
      fireEvent.blur(field);
    }
    const payload = await save();

    expect(payload.recipeIngredients).toEqual(
      stored.recipeIngredients.map(({ id, version, ingredientName, amount, unit, order }) =>
        expect.objectContaining({ id, version, ingredientName, amount, unit, order })
      )
    );
    expect(payload.steps).toEqual(
      stored.steps.map(({ step, order, version, images, stepIngredients }) =>
        expect.objectContaining({ step, order, version, images, stepIngredients })
      )
    );
  });

  it("keeps every reference on its line when a referenced line is moved", async () => {
    open();
    const { values, onReorder } = mocks.reorders.get("ing")!;
    const [section, salt, hoisin, secondSalt, lemon, trailing] = values;

    act(() => onReorder([secondSalt, section, salt, hoisin, lemon, trailing]));
    // The rows hand their lines over once typing pauses.
    await waitFor(() => expect(mocks.reorders.get("ing")?.values[0]).toBe(secondSalt));
    await new Promise((resolve) => setTimeout(resolve, 350));
    const payload = await save();

    expect(payload.recipeIngredients.map((ing) => ing.id)).toEqual([
      "ing-4",
      "ing-1",
      "ing-2",
      "ing-3",
      "ing-5",
    ]);
    expect(refIds(payload)).toEqual([[], ["ing-3", "ing-4"], ["ing-5"]]);
  });
  it("keeps a reference on its line when a line above is cleared and Save tapped at once", async () => {
    open();
    const [salt] = screen.getAllByDisplayValue("salt");

    fireEvent.focus(salt!);
    fireEvent.change(salt!, { target: { value: "" } });
    // Inside the parse's pause; a click on Save blurs the field first, as a browser does.
    fireEvent.blur(salt!);
    const payload = await save();

    expect(payload.recipeIngredients.map((ing) => ing.id)).toEqual([
      "ing-1",
      "ing-3",
      "ing-4",
      "ing-5",
    ]);
    expect(refIds(payload)).toEqual([[], ["ing-3", "ing-4"], ["ing-5"]]);
  });
});
