import type { ParsedIngredient } from "@/features/recipes/components/editor/ingredient-input";
import type { Step } from "@/features/recipes/components/editor/step-input";
import type { ReactElement } from "react";
import { deliver, fakeProcedure } from "@/__tests__/helpers/trpc-fake";
import { RecipeEditorScreen } from "@/features/recipes/recipe-editor-screen";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

const mocks = vi.hoisted(() => ({ createRecipe: vi.fn(), push: vi.fn() }));

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, back: vi.fn() }),
}));

// The English UI: built-ins carry their English labels.
const LABELS: Record<string, string> = {
  "category.breakfast": "Breakfast",
  "category.lunch": "Lunch",
  "category.dinner": "Dinner",
  "category.snack": "Snack",
};

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => LABELS[key] ?? key,
}));
vi.mock("@norish/shared-react/config", () => ({
  useIngredientsSubscription: () => undefined,
  useUnitsQuery: () => ({ units: {}, isLoading: false }),
  useCategoriesQuery: () => ({
    categories: ["Breakfast", "Lunch", "Dinner", "Snack", "Puddings", "Drinks"],
    // Every locale's label folds to its built-in, as the server sends them.
    builtInAliases: {
      breakfast: "Breakfast",
      ontbijt: "Breakfast",
      "petit dejeuner": "Breakfast",
      snack: "Snack",
    },
    isLoading: false,
  }),
}));
vi.mock("@norish/shared-react/reader", async () =>
  (await import("@/__tests__/helpers/reader-mock")).mockDevicePreferences()
);
vi.mock("@norish/shared-react/recipes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/recipes")>()),
  useRecipeId: () => ({ recipeId: "recipe-1", isLoading: false, error: null }),
}));
vi.mock("@/hooks/use-recipes-mutations", () => ({
  useRecipesMutations: () => ({ createRecipe: mocks.createRecipe, updateRecipe: vi.fn() }),
}));
vi.mock("@/features/recipes/hooks/use-unsaved-navigation-guard", () => ({
  useUnsavedNavigationGuard: () => ({
    allowNavigation: vi.fn(),
    confirmNavigation: () => true,
    disallowNavigation: vi.fn(),
  }),
}));

// The other sections are stubbed down to a button that fills them with one line.
const FLOUR: ParsedIngredient = {
  ingredientName: "flour",
  amount: 200,
  unit: "g",
  order: 0,
  systemUsed: "metric",
};
const MIX: Step = { step: "Mix", order: 0, systemUsed: "metric" };

vi.mock("@/features/recipes/components/editor/ingredient-input", () => ({
  default: ({ onChange }: { onChange: (items: ParsedIngredient[]) => void }) => (
    <button type="button" onClick={() => onChange([FLOUR])}>
      add-ingredient
    </button>
  ),
}));
vi.mock("@/features/recipes/components/editor/step-input", () => ({
  default: ({ onChange }: { onChange: (items: Step[]) => void }) => (
    <button type="button" onClick={() => onChange([MIX])}>
      add-step
    </button>
  ),
}));
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

/** The editor over the fake tRPC client, in a fresh cache it answers. */
function renderEditor(ui: ReactElement) {
  const queryClient = createTestQueryClient();

  render(ui, { wrapper: createTestWrapper(queryClient) });

  return queryClient;
}

function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText("recipeNamePlaceholder"), {
    target: { value: "Bread" },
  });
  fireEvent.click(screen.getByRole("button", { name: "add-ingredient" }));
  fireEvent.click(screen.getByRole("button", { name: "add-step" }));
}

beforeEach(() => {
  mocks.createRecipe.mockReset();
  mocks.push.mockReset();
});

describe("RecipeForm servings (#684)", () => {
  it("stays empty when cleared, so a new count can be typed", () => {
    renderEditor(<RecipeEditorScreen mode="create" />);
    const servings = screen.getByLabelText("servings");

    fireEvent.change(servings, { target: { value: "" } });
    expect(servings).toHaveValue(null);

    fireEvent.change(servings, { target: { value: "2" } });
    expect(servings).toHaveValue(2);
  });

  it("saves the count typed after clearing", async () => {
    renderEditor(<RecipeEditorScreen mode="create" />);
    fillRequiredFields();
    const servings = screen.getByLabelText("servings");

    fireEvent.change(servings, { target: { value: "" } });
    fireEvent.change(servings, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "createRecipe" }));

    await waitFor(() =>
      expect(mocks.createRecipe).toHaveBeenCalledWith(expect.objectContaining({ servings: 2 }))
    );
  });

  it("opens the recipe it created", async () => {
    renderEditor(<RecipeEditorScreen mode="create" />);
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "createRecipe" }));

    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/recipes/recipe-1"));
  });

  it("refuses to save while empty", async () => {
    renderEditor(<RecipeEditorScreen mode="create" />);
    fillRequiredFields();

    fireEvent.change(screen.getByLabelText("servings"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "createRecipe" }));

    expect(await screen.findByText("servingsMin")).toBeInTheDocument();
    expect(mocks.createRecipe).not.toHaveBeenCalled();
  });
});

describe("RecipeForm categories", () => {
  const mojito: FullRecipeDTO = {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "user-1",
    name: "Mojito",
    description: null,
    url: null,
    servings: 1,
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
    createdAt: new Date("2026-05-01T10:00:00.000Z"),
    updatedAt: new Date("2026-05-01T10:00:00.000Z"),
    categories: ["Cocktails"],
    version: 1,
    recipeIngredients: [],
    steps: [],
    tags: [],
    images: [],
    videos: [],
  };

  it("offers the household's list and the recipe's own, labelling only built-ins", () => {
    renderEditor(<RecipeEditorScreen initialData={mojito} mode="edit" />);

    expect(screen.getByRole("button", { name: "Breakfast" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Puddings" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "Cocktails" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  function addCategory(name: string) {
    const field = screen.getByRole("textbox", { name: "addCategory" });

    fireEvent.change(field, { target: { value: name } });
    fireEvent.keyDown(field, { key: "Enter" });
  }

  function pressedChips() {
    return screen
      .getAllByRole("button", { pressed: true })
      .map((chip) => chip.textContent)
      .sort();
  }

  it("adds a typed name as a selected chip of its own", () => {
    renderEditor(<RecipeEditorScreen initialData={mojito} mode="edit" />);

    addCategory("  Long   drinks ");

    expect(pressedChips()).toEqual(["Cocktails", "Long drinks"]);
    expect(screen.getByRole("textbox", { name: "addCategory" })).toHaveValue("");
  });

  it("selects the existing chip for another casing, a translation or a built-in plural", () => {
    renderEditor(<RecipeEditorScreen initialData={mojito} mode="edit" />);

    addCategory("puddings");
    addCategory("SNACKS");
    addCategory("Desserts");

    expect(pressedChips()).toEqual(["Cocktails", "Desserts", "Puddings", "Snack"]);
    expect(screen.getAllByRole("button", { name: "Puddings" })).toHaveLength(1);
  });

  it.each(["Ontbijt", "breakfasts", "BREAKFAST", "Petit-déjeuner"])(
    "selects the Breakfast chip for %s in the English UI",
    (typed) => {
      renderEditor(<RecipeEditorScreen initialData={mojito} mode="edit" />);

      addCategory(typed);

      expect(pressedChips()).toEqual(["Breakfast", "Cocktails"]);
    }
  );

  it("selects an existing household chip for another casing", () => {
    renderEditor(<RecipeEditorScreen initialData={mojito} mode="edit" />);

    addCategory("drinks");

    expect(pressedChips()).toEqual(["Cocktails", "Drinks"]);
    expect(screen.getAllByRole("button", { name: "Drinks" })).toHaveLength(1);
  });

  it("drops Breakfast on save once deselected after typing another locale's name", async () => {
    renderEditor(<RecipeEditorScreen mode="create" />);
    fillRequiredFields();

    fireEvent.click(screen.getByRole("button", { name: "Breakfast" }));
    addCategory("Ontbijt");
    expect(pressedChips()).toEqual(["Breakfast"]);

    fireEvent.click(screen.getByRole("button", { name: "Breakfast" }));
    fireEvent.click(screen.getByRole("button", { name: "createRecipe" }));

    await waitFor(() =>
      expect(mocks.createRecipe).toHaveBeenCalledWith(expect.objectContaining({ categories: [] }))
    );
  });
});

describe("RecipeEditorScreen while open", () => {
  it("rereads the household's Categories when a housemate saves a recipe", () => {
    const queryClient = renderEditor(<RecipeEditorScreen mode="create" />);
    const categories = fakeProcedure("config.categories").queryKey();

    queryClient.setQueryData(categories, { categories: [], builtInAliases: {} });
    act(() => deliver("recipes.onCreated", { recipe: { id: "r-new", name: "Soup" } }));

    expect(queryClient.getQueryState(categories)?.isInvalidated).toBe(true);
  });
});
