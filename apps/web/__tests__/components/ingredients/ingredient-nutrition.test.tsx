import type { QueryClient } from "@tanstack/react-query";
import { readAnswers, sentWrites } from "@/__tests__/helpers/trpc-fake";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { IngredientNutritionSection } from "@/components/ingredients/ingredient-nutrition";

import type {
  IngredientNutrition,
  NutritionFact,
  NutritionSource,
} from "@norish/shared/contracts/ingredient-nutrition";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

const mocks = vi.hoisted(() => ({
  nutrition: null as IngredientNutrition | null,
  measure: null as string | null,
}));

vi.mock("@norish/shared-react/trpc", async () =>
  (await import("@/__tests__/helpers/trpc-fake")).mockTRPC()
);

let queryClient: QueryClient;

/** The section over a fresh cache, its reads answered; writes stay unanswered, as on a slow server. */
async function renderSection(ingredientId: string, name: string) {
  queryClient = createTestQueryClient();
  readAnswers.set("ingredients.nutrition", async () => mocks.nutrition);
  readAnswers.set("ingredients.spoonMeasure", async () => mocks.measure);
  readAnswers.set("ingredients.nutritionFoods", async () => []);
  render(<IngredientNutritionSection ingredientId={ingredientId} name={name} />, {
    wrapper: createTestWrapper(queryClient),
  });
  await screen.findByTestId("ingredient-nutrition-open");
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
}

/** What the section sent the server, by procedure. */
const sent = (path: string) =>
  sentWrites.mock.calls.filter(([written]) => written === path).map(([, input]) => input);

vi.mock("next-intl", () => ({
  useFormatter: () => ({ number: (value: number) => String(Math.round(value * 10) / 10) }),
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

vi.mock("@/components/shared/action-button", () => ({
  ActionButton: ({ children, onPress, isDisabled, "data-testid": testId }: any) => (
    <button data-testid={testId} disabled={isDisabled} type="button" onClick={onPress}>
      {children}
    </button>
  ),
  ActionButtonGroup: ({ children, start }: any) => (
    <div>
      {start}
      {children}
    </div>
  ),
}));

vi.mock("@/components/Panel/Panel", () => {
  const Panel = ({ children, open, title }: any) =>
    open ? (
      <div aria-label={title} role="dialog">
        {children}
      </div>
    ) : null;

  Panel.Body = ({ children }: any) => <div>{children}</div>;
  Panel.Footer = ({ children }: any) => <div>{children}</div>;

  return { default: Panel, PanelPortal: ({ children }: { children: React.ReactNode }) => children };
});

const ONION_RAW = { dataset: "ciqual" as const, code: "20034", name: "Onion, raw" };

/** The facts live in a panel of their own, behind the summary row. */
const openNutrition = () => fireEvent.click(screen.getByTestId("ingredient-nutrition-open"));
/** Correct is in the nutrition panel's footer. */
const openCorrection = () => {
  openNutrition();
  fireEvent.click(screen.getByTestId("ingredient-nutrition-correct"));
};
const correction = () => screen.getByRole("dialog", { name: /^correctTitle/ });

describe("an Ingredient's nutrition in its panel", () => {
  beforeEach(() => {
    sentWrites.mockClear();
    mocks.measure = null;
    mocks.nutrition = {
      numbers: {
        value: { kcal: 35, fat: 0.2, carbs: 6.8, protein: 1.1 },
        source: { kind: "code", food: ONION_RAW },
        borrowedFrom: null,
      },
      pieceWeight: { value: 150, source: { kind: "taxonomy" }, borrowedFrom: null },
      density: null,
    };
  });

  it("sums the food up in one row, which opens the nutrition panel", async () => {
    await renderSection("onion", "onion");

    expect(screen.getByTestId("ingredient-nutrition-summary")).toHaveTextContent(
      'summary {"value":"35"}'
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByTestId("ingredient-nutrition-open"));
    expect(screen.getByRole("dialog", { name: "section" })).toBeInTheDocument();
  });

  it("shows the four numbers per 100 g and the dataset food they came from", async () => {
    await renderSection("onion", "onion");
    openNutrition();

    const numbers = screen.getByTestId("ingredient-nutrition-numbers");

    expect(numbers).toHaveTextContent('kcal {"value":"35"}');
    expect(numbers).toHaveTextContent('grams {"value":"6.8"}');
    expect(screen.getByTestId("ingredient-nutrition-source")).toHaveTextContent(
      'source.code {"food":"Onion, raw","dataset":"CIQUAL 2025"}'
    );
    expect(screen.getByTestId("ingredient-nutrition-piece")).toHaveTextContent(
      'onePieceLabelgrams {"value":"150"}'
    );
    expect(screen.queryByTestId("ingredient-nutrition-density")).toBeNull();
  });

  it("says where borrowed numbers come from", async () => {
    mocks.nutrition = {
      numbers: { ...mocks.nutrition!.numbers!, borrowedFrom: { id: "onion", name: "onion" } },
      pieceWeight: null,
      density: null,
    };

    await renderSection("red-onion", "red onion");
    openNutrition();

    expect(screen.getByTestId("ingredient-nutrition-source")).toHaveTextContent(
      'borrowed {"name":"onion"'
    );
  });

  it("says when AI estimated the numbers", async () => {
    mocks.nutrition = {
      ...mocks.nutrition!,
      numbers: { ...mocks.nutrition!.numbers!, source: { kind: "ai" } },
    };

    await renderSection("onion", "onion");
    openNutrition();

    expect(screen.getByTestId("ingredient-nutrition-source")).toHaveTextContent("source.ai");
  });

  it("says it knows nothing where it does not", async () => {
    mocks.nutrition = { numbers: null, pieceWeight: null, density: null };

    await renderSection("brandy", "brandy");

    expect(screen.getByTestId("ingredient-nutrition-summary")).toHaveTextContent("summaryNone");
    openNutrition();
    expect(screen.getByTestId("ingredient-nutrition-none")).toBeInTheDocument();
  });

  describe("a spoon's weight", () => {
    const CUMIN_SEED = { dataset: "usda" as const, code: "170923", name: "Spices, cumin seed" };
    const density = (value: number, source: NutritionSource): NutritionFact<number> => ({
      value,
      source,
      borrowedFrom: null,
    });

    it("shows no spoon row where no recipe the household can open measures the food by volume", async () => {
      mocks.nutrition = { ...mocks.nutrition!, density: density(0.67, { kind: "taxonomy" }) };

      await renderSection("onion", "onion");
      openNutrition();

      expect(screen.queryByTestId("ingredient-nutrition-density")).toBeNull();
    });

    it("states it in the measure the household's recipes use most, with where it came from", async () => {
      mocks.measure = "teaspoon";
      mocks.nutrition = {
        ...mocks.nutrition!,
        density: density(0.4, { kind: "fix", food: CUMIN_SEED }),
      };

      await renderSection("cumin", "cumin");
      openNutrition();

      const row = screen.getByTestId("ingredient-nutrition-density");

      expect(row).toHaveTextContent('spoon.teaspoongrams {"value":"2"}');
      expect(row).toHaveTextContent(
        'source.fix {"food":"Spices, cumin seed","dataset":"USDA FoodData Central"}'
      );
    });

    it("reads millilitres to litres per 100 ml", async () => {
      mocks.measure = "100ml";
      mocks.nutrition = { ...mocks.nutrition!, density: density(1.03, { kind: "taxonomy" }) };

      await renderSection("milk", "milk");
      openNutrition();

      expect(screen.getByTestId("ingredient-nutrition-density")).toHaveTextContent(
        'spoon.hundredMlgrams {"value":"103"}'
      );
    });

    it("asks for the weight in that measure where none is known, and keeps it as a density", async () => {
      mocks.measure = "teaspoon";

      await renderSection("cumin", "cumin");
      openNutrition();
      fireEvent.click(screen.getByTestId("ingredient-nutrition-density-ask"));

      const panel = correction();

      expect(within(panel).getByText("label.spoonGrams.teaspoon")).toBeInTheDocument();
      // The household has no correction yet: there is nothing to remove.
      expect(within(panel).queryByTestId("nutrition-correction-remove")).toBeNull();
      fireEvent.change(within(panel).getByTestId("nutrition-correction-spoonGrams"), {
        target: { value: "2" },
      });
      fireEvent.click(within(panel).getByTestId("nutrition-correction-save"));

      await vi.waitFor(() =>
        expect(sent("ingredients.correctNutrition")).toContainEqual({
          ingredientId: "cumin",
          numbers: null,
          pieceWeight: null,
          density: { gramsPerMl: 0.4 },
        })
      );
    });

    it("keeps a correction made in another measure as it was, saved unchanged", async () => {
      mocks.measure = "teaspoon";
      // Typed before as a cup weighing 125 g.
      mocks.nutrition = { ...mocks.nutrition!, density: density(125 / 240, { kind: "household" }) };

      await renderSection("flour", "flour");
      openCorrection();

      const panel = correction();

      expect(within(panel).getByTestId("nutrition-correction-spoonGrams")).toHaveValue("2.6");
      fireEvent.click(within(panel).getByTestId("nutrition-correction-save"));

      await vi.waitFor(() =>
        expect(sent("ingredients.correctNutrition")).toContainEqual(
          expect.objectContaining({ density: { gramsPerMl: 125 / 240 } })
        )
      );
    });
  });

  it("corrects the numbers from a label, and a cup's weight as a density", async () => {
    mocks.measure = "cup";
    await renderSection("milk", "milk");
    openCorrection();

    const panel = correction();

    // Each fact says what it is now, so the viewer sees what the correction replaces.
    expect(within(panel).getByTestId("nutrition-correction-numbers-now")).toHaveTextContent(
      'current {"value":"kcal {\\"value\\":\\"35\\"}"'
    );
    expect(within(panel).getByTestId("nutrition-correction-density-now")).toHaveTextContent(
      "currentNone"
    );
    fireEvent.click(within(panel).getByTestId("nutrition-correction-numbers-label"));
    for (const [field, value] of [
      ["calories", "47"],
      ["fat", "1,5"],
      ["carbs", "4.8"],
      ["protein", "3.4"],
    ] as const) {
      fireEvent.change(within(panel).getByTestId(`nutrition-correction-${field}`), {
        target: { value },
      });
    }
    fireEvent.click(within(panel).getByTestId("nutrition-correction-density-label"));
    fireEvent.change(within(panel).getByTestId("nutrition-correction-spoonGrams"), {
      target: { value: "247" },
    });
    fireEvent.click(within(panel).getByTestId("nutrition-correction-save"));

    await vi.waitFor(() =>
      expect(sent("ingredients.correctNutrition")).toContainEqual({
        ingredientId: "milk",
        numbers: { kcal: 47, fat: 1.5, carbs: 4.8, protein: 3.4 },
        pieceWeight: null,
        density: { gramsPerMl: 247 / 240 },
      })
    );
    // The facts show the correction the moment it is saved, credited to the household.
    expect(
      queryClient.getQueryData([
        ["ingredients", "nutrition"],
        { input: { ingredientId: "milk" }, type: "query" },
      ])
    ).toEqual(
      expect.objectContaining({
        numbers: {
          value: { kcal: 47, fat: 1.5, carbs: 4.8, protein: 3.4 },
          source: { kind: "household" },
          borrowedFrom: null,
        },
        density: expect.objectContaining({ source: { kind: "household" } }),
      })
    );
  });

  it("holds Save until every number of a label is there", async () => {
    await renderSection("milk", "milk");
    openCorrection();

    const panel = correction();

    fireEvent.click(within(panel).getByTestId("nutrition-correction-numbers-label"));
    fireEvent.change(within(panel).getByTestId("nutrition-correction-calories"), {
      target: { value: "47" },
    });

    expect(within(panel).getByTestId("nutrition-correction-save")).toBeDisabled();
  });

  it("starts from the household's correction, and removes it", async () => {
    mocks.nutrition = {
      numbers: {
        value: { kcal: 47, fat: 1.5, carbs: 4.8, protein: 3.4 },
        source: { kind: "household" },
        borrowedFrom: null,
      },
      pieceWeight: null,
      density: null,
    };

    await renderSection("milk", "milk");
    openCorrection();

    const panel = correction();

    expect(within(panel).getByTestId("nutrition-correction-calories")).toHaveValue("47");
    fireEvent.click(within(panel).getByTestId("nutrition-correction-remove"));

    await vi.waitFor(() =>
      expect(sent("ingredients.removeNutritionCorrection")).toEqual([{ ingredientId: "milk" }])
    );
  });
});
