import type { ParsedIngredient } from "@/features/recipes/components/editor/ingredient-input";
import type { Step } from "@/features/recipes/components/editor/step-input";
import type { ReactElement } from "react";
import {
  deliver,
  fakeProcedure,
  readAnswers,
  sentReads,
  sentWrites,
  writeAnswers,
} from "@/__tests__/helpers/trpc-fake";
import { RecipeEditorScreen } from "@/features/recipes/recipe-editor-screen";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

const mocks = vi.hoisted(() => ({
  createRecipe: vi.fn(),
  push: vi.fn(),
  readerHousehold: "household-2" as string | null,
}));

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
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    LABELS[key] ?? (params ? `${key} ${Object.values(params).join(" ")}` : key),
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
  (await import("@/__tests__/helpers/reader-mock")).mockDevicePreferences(undefined, {
    reader: () => ({ permissions: { householdId: mocks.readerHousehold } }),
  })
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
vi.mock("@/components/shared/tag-picker", () => ({ default: () => null }));
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

const entry = (id: string, name: string, instance = false) => ({ id, name, instance });

beforeEach(() => {
  mocks.createRecipe.mockReset();
  mocks.push.mockReset();
  mocks.readerHousehold = "household-2";
  sentWrites.mockReset();
  readAnswers.clear();
  writeAnswers.clear();
  // jsdom has no scrolling; the open listbox scrolls its focused row into view.
  HTMLElement.prototype.scrollTo = () => {};
  readAnswers.set("lists.list", async () => [
    entry("b", "Breakfast", true),
    entry("l", "Lunch", true),
    entry("d", "Dinner", true),
    entry("s", "Snack", true),
    entry("p", "Puddings"),
    entry("dr", "Drinks"),
  ]);
  writeAnswers.set("lists.add", async (input) => ({
    created: true,
    entry: entry(`new-${(input as { name: string }).name}`, (input as { name: string }).name),
  }));
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
    householdId: "household-1",
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

  it("offers the recipe's household's list and the recipe's own, labelling only built-ins", async () => {
    renderEditor(<RecipeEditorScreen initialData={mojito} mode="edit" />);

    expect(await screen.findByRole("button", { name: "Breakfast" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Puddings" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    expect(screen.getByRole("button", { name: "Cocktails" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("reads the list of another household's recipe being edited, not the editor's", async () => {
    renderEditor(<RecipeEditorScreen initialData={mojito} mode="edit" />);

    await screen.findByRole("button", { name: "Breakfast" });
    expect(sentReads).toHaveBeenCalledWith("lists.list", { kind: "category", recipeId: mojito.id });
  });

  it("reads the household's own list for a recipe of the reader's household, as the cache has it", async () => {
    mocks.readerHousehold = "household-1";
    renderEditor(<RecipeEditorScreen initialData={mojito} mode="edit" />);

    await screen.findByRole("button", { name: "Breakfast" });
    expect(sentReads).toHaveBeenCalledWith("lists.list", { kind: "category" });
    expect(sentReads).not.toHaveBeenCalledWith(
      "lists.list",
      expect.objectContaining({ recipeId: mojito.id })
    );
  });

  async function typeCategory(user: ReturnType<typeof userEvent.setup>, text: string) {
    await user.type(screen.getByRole("combobox", { name: "addCategory" }), text);
  }

  function pressedChips() {
    return screen
      .getAllByRole("button", { pressed: true, hidden: true })
      .map((chip) => chip.textContent)
      .sort();
  }

  it("selects the existing chip for another casing, without creating anything", async () => {
    const user = userEvent.setup();

    renderEditor(<RecipeEditorScreen initialData={mojito} mode="edit" />);
    await screen.findByRole("button", { name: "Puddings" });
    await typeCategory(user, "puddings");

    expect(screen.queryByRole("option", { name: /^create/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("option", { name: "Puddings" }));

    await waitFor(() => expect(pressedChips()).toEqual(["Cocktails", "Puddings"]));
    expect(sentWrites).not.toHaveBeenCalledWith("lists.add", expect.anything());
  });

  it("creates a new Category only through the Create row, then selects it", async () => {
    const user = userEvent.setup();

    renderEditor(<RecipeEditorScreen initialData={mojito} mode="edit" />);
    await screen.findByRole("button", { name: "Puddings" });
    await typeCategory(user, "  Long   drinks ");
    await user.click(screen.getByRole("option", { name: "create Long drinks" }));

    await waitFor(() => expect(pressedChips()).toEqual(["Cocktails", "Long drinks"]));
    expect(sentWrites).toHaveBeenCalledWith("lists.add", {
      kind: "category",
      name: "Long drinks",
      recipeId: mojito.id,
    });
  });

  it.each(["Ontbijt", "breakfasts", "BREAKFAST", "Petit-déjeuner"])(
    "offers Breakfast, not a new Category, for %s",
    async (typed) => {
      const user = userEvent.setup();

      renderEditor(<RecipeEditorScreen initialData={mojito} mode="edit" />);
      await screen.findByRole("button", { name: "Puddings" });
      await typeCategory(user, typed);

      expect(screen.queryByRole("option", { name: /^create/ })).not.toBeInTheDocument();
      await user.click(screen.getByRole("option", { name: "Breakfast" }));

      await waitFor(() => expect(pressedChips()).toEqual(["Breakfast", "Cocktails"]));
    }
  );

  it("does not offer a name over 40 characters, and says why", async () => {
    const user = userEvent.setup();

    renderEditor(<RecipeEditorScreen initialData={mojito} mode="edit" />);
    await screen.findByRole("button", { name: "Puddings" });
    await typeCategory(user, "x".repeat(41));

    expect(screen.queryByRole("option", { name: /^create/ })).not.toBeInTheDocument();
    expect(screen.getAllByText("tooLong 40").length).toBeGreaterThan(0);
  });

  it("saves only what was picked: a typed name nobody created is not a Category", async () => {
    const user = userEvent.setup();

    renderEditor(<RecipeEditorScreen mode="create" />);
    await screen.findByRole("button", { name: "Breakfast" });
    fillRequiredFields();
    fireEvent.click(screen.getByRole("button", { name: "Breakfast" }));
    await typeCategory(user, "Typed but never created");
    await user.keyboard("{Escape}");
    fireEvent.click(await screen.findByRole("button", { name: "createRecipe" }));

    await waitFor(() =>
      expect(mocks.createRecipe).toHaveBeenCalledWith(
        expect.objectContaining({ categories: ["Breakfast"] })
      )
    );
    expect(sentWrites).not.toHaveBeenCalledWith("lists.add", expect.anything());
  });

  it("drops Breakfast on save once deselected after picking it by another locale's name", async () => {
    const user = userEvent.setup();

    renderEditor(<RecipeEditorScreen mode="create" />);
    await screen.findByRole("button", { name: "Breakfast" });
    fillRequiredFields();
    await typeCategory(user, "Ontbijt");
    await user.click(screen.getByRole("option", { name: "Breakfast" }));
    await waitFor(() => expect(pressedChips()).toEqual(["Breakfast"]));

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
