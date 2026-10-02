import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { NutritionBody } from "@/components/recipes/readonly-nutrition";

vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

function arcs(container: HTMLElement): SVGCircleElement[] {
  return Array.from(container.querySelectorAll("circle"));
}

function arcLengths(container: HTMLElement): number[] {
  return arcs(container).map((arc) =>
    Number.parseFloat((arc.getAttribute("stroke-dasharray") ?? "").split(" ")[0] ?? "0")
  );
}

/**
 * The arcs are calorie contribution and the centre is the recipe's own
 * stored calories: the two are allowed to disagree, and a figure computed
 * from macros is never printed as the recipe's.
 */
describe("Nutrition donut", () => {
  it("sizes the arcs by calorie contribution, not by grams", () => {
    const { container } = render(
      <NutritionBody portions={1} recipe={{ calories: 400, fat: 10, carbs: 10, protein: 10 }} />
    );

    const [fat, carbs, protein] = arcLengths(container);

    expect(fat).toBeCloseTo((90 / 170) * 100);
    expect(carbs).toBeCloseTo((40 / 170) * 100);
    expect(protein).toBeCloseTo((40 / 170) * 100);
  });

  it("puts the stored calories in the centre, not a computed figure", () => {
    render(
      <NutritionBody portions={1} recipe={{ calories: 400, fat: 10, carbs: 10, protein: 10 }} />
    );

    // The macros account for 170 kcal; the recipe stores 400 and that wins.
    expect(screen.getByText("400")).toBeInTheDocument();
    expect(screen.queryByText("170")).not.toBeInTheDocument();
  });

  it("shows no calorie figure for a recipe with macros and no stored calories", () => {
    const { container } = render(
      <NutritionBody portions={1} recipe={{ calories: null, fat: 10, carbs: 10, protein: 10 }} />
    );

    expect(arcs(container)).toHaveLength(3);
    expect(screen.queryByText("recipes.nutrition.calories")).not.toBeInTheDocument();
  });

  it("marks the calories with an asterisk for a total that left lines out, and only then", () => {
    const recipe = { calories: 400, fat: 10, carbs: 10, protein: 10 };
    const { rerender } = render(<NutritionBody marked portions={1} recipe={recipe} />);

    expect(screen.getByTestId("nutrition-calories-mark")).toHaveTextContent("*");

    rerender(
      <NutritionBody
        marked
        portions={1}
        recipe={{ ...recipe, fat: null, carbs: null, protein: null }}
      />
    );
    expect(screen.getByTestId("nutrition-calories-mark")).toHaveTextContent("*");

    rerender(<NutritionBody portions={1} recipe={recipe} />);
    expect(screen.queryByTestId("nutrition-calories-mark")).not.toBeInTheDocument();
  });

  it("draws no ring for a recipe with calories and no macros", () => {
    const { container } = render(
      <NutritionBody
        portions={1}
        recipe={{ calories: 400, fat: null, carbs: null, protein: null }}
      />
    );

    expect(arcs(container)).toHaveLength(0);
    expect(screen.getByText("400")).toBeInTheDocument();
  });

  it("draws only the arcs the recipe stores", () => {
    const { container } = render(
      <NutritionBody portions={1} recipe={{ calories: 400, fat: 10, carbs: null, protein: 10 }} />
    );

    expect(arcs(container)).toHaveLength(2);
    expect(screen.queryByText("recipes.nutrition.carbs")).not.toBeInTheDocument();
  });

  it("scales the legend with the portion control and leaves the arcs alone", () => {
    const recipe = { calories: 400, fat: 10, carbs: 10, protein: 10 };
    const single = render(<NutritionBody portions={1} recipe={recipe} />);
    const before = arcLengths(single.container);

    single.unmount();

    const doubled = render(<NutritionBody portions={2} recipe={recipe} />);

    expect(arcLengths(doubled.container)).toEqual(before);
    // Two portions: 20g of each macro, 800 kcal.
    expect(screen.getAllByText("20")).toHaveLength(3);
    expect(screen.getByText("800")).toBeInTheDocument();
  });

  it("renders nothing for a recipe with neither macros nor calories", () => {
    const { container } = render(
      <NutritionBody
        portions={1}
        recipe={{ calories: null, fat: null, carbs: null, protein: null }}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
