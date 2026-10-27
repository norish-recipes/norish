import type { ParsedIngredient } from "@/components/recipes/ingredient-input";
import type { Step } from "@/components/recipes/step-input";
import RecipeForm from "@/app/(app)/recipes/edit/components/recipe-form";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createRecipe: vi.fn() }));

vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));
vi.mock("@/context/recipes-context", () => ({
  useRecipesContext: () => ({ createRecipe: mocks.createRecipe, updateRecipe: vi.fn() }),
}));
vi.mock("@/hooks/config", () => ({ useUnitsQuery: () => ({ units: {}, isLoading: false }) }));
vi.mock("@/hooks/recipes", () => ({
  useRecipeId: () => ({ recipeId: "recipe-1", isLoading: false, error: null }),
}));
vi.mock("@/hooks/use-unsaved-navigation-guard", () => ({
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

vi.mock("@/components/recipes/ingredient-input", () => ({
  default: ({ onChange }: { onChange: (items: ParsedIngredient[]) => void }) => (
    <button type="button" onClick={() => onChange([FLOUR])}>
      add-ingredient
    </button>
  ),
}));
vi.mock("@/components/recipes/step-input", () => ({
  default: ({ onChange }: { onChange: (items: Step[]) => void }) => (
    <button type="button" onClick={() => onChange([MIX])}>
      add-step
    </button>
  ),
}));
vi.mock("@/components/recipes/media-gallery-input", () => ({ default: () => null }));
vi.mock("@/components/recipes/measurement-system-selector", () => ({ default: () => null }));
vi.mock("@/components/recipes/time-inputs", () => ({ default: () => null }));
vi.mock("@/components/shared/smart-input-help", () => ({ default: () => null }));
vi.mock("@/components/shared/smart-text-input", () => ({ default: () => null }));
vi.mock("@/components/shared/tag-input", () => ({ default: () => null }));
vi.mock("@/app/(app)/recipes/edit/components/provenance-fields", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  default: () => null,
}));

function fillRequiredFields() {
  fireEvent.change(screen.getByPlaceholderText("recipeNamePlaceholder"), {
    target: { value: "Bread" },
  });
  fireEvent.click(screen.getByRole("button", { name: "add-ingredient" }));
  fireEvent.click(screen.getByRole("button", { name: "add-step" }));
}

beforeEach(() => {
  mocks.createRecipe.mockReset();
});

describe("RecipeForm servings (#684)", () => {
  it("stays empty when cleared, so a new count can be typed", () => {
    render(<RecipeForm mode="create" />);
    const servings = screen.getByLabelText("servings");

    fireEvent.change(servings, { target: { value: "" } });
    expect(servings).toHaveValue(null);

    fireEvent.change(servings, { target: { value: "2" } });
    expect(servings).toHaveValue(2);
  });

  it("saves the count typed after clearing", async () => {
    render(<RecipeForm mode="create" />);
    fillRequiredFields();
    const servings = screen.getByLabelText("servings");

    fireEvent.change(servings, { target: { value: "" } });
    fireEvent.change(servings, { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "createRecipe" }));

    await waitFor(() =>
      expect(mocks.createRecipe).toHaveBeenCalledWith(expect.objectContaining({ servings: 2 }))
    );
  });

  it("refuses to save while empty", async () => {
    render(<RecipeForm mode="create" />);
    fillRequiredFields();

    fireEvent.change(screen.getByLabelText("servings"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "createRecipe" }));

    expect(await screen.findByText("servingsMin")).toBeInTheDocument();
    expect(mocks.createRecipe).not.toHaveBeenCalled();
  });
});
