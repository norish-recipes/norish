import { fireEvent, render, screen } from "@testing-library/react";
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

describe("Nutrition donut with the other nutrients", () => {
  const recipe = {
    calories: 450,
    fat: 10,
    carbs: 20,
    protein: 10,
    nutritionExtras: { saturatedFat: 3, sugars: 10, fiber: 10, sodium: 480 },
  };

  it("keeps the ring to fat, carbs and protein", () => {
    const { container } = render(<NutritionBody portions={1} recipe={recipe} />);
    const [fat, carbs, protein] = arcLengths(container);

    expect(arcs(container)).toHaveLength(3);
    expect(fat).toBeCloseTo((90 / 210) * 100);
    expect(carbs).toBeCloseTo((80 / 210) * 100);
    expect(protein).toBeCloseTo((40 / 210) * 100);
  });

  it("lists saturates under fat and sugars under carbs", () => {
    render(<NutritionBody portions={1} recipe={recipe} />);

    expect(screen.getByTestId("nutrition-saturatedFat")).toHaveTextContent(
      "recipes.nutrition.saturatedFat3g"
    );
    expect(screen.getByTestId("nutrition-sugars")).toHaveTextContent("10g");
  });

  it("keeps fiber and sodium behind More nutrients until it is opened", () => {
    render(<NutritionBody portions={1} recipe={recipe} />);
    const toggle = screen.getByTestId("nutrition-more-toggle");

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveTextContent("recipes.nutrition.moreNutrients");
    expect(screen.queryByTestId("nutrition-sodium")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).toHaveTextContent("recipes.nutrition.fewerNutrients");
    expect(screen.getByTestId("nutrition-fiber")).toHaveTextContent("10g");
    expect(screen.getByTestId("nutrition-sodium")).toHaveTextContent("480mg");
  });

  it("stars a nutrient that not every counted line's food knew, and says why", () => {
    render(
      <NutritionBody
        portions={1}
        recipe={{ ...recipe, extrasCoverage: { sugars: 0.6, saturatedFat: 1 } }}
      />
    );

    expect(screen.getByTestId("nutrition-sugars")).toHaveTextContent("10*g");
    expect(screen.getByTestId("nutrition-saturatedFat")).not.toHaveTextContent("*");
    expect(screen.getByTestId("nutrition-star-note")).toHaveTextContent(
      "recipes.nutrition.starredMayBeHigher"
    );
  });

  it("leaves the explanation to the card when lines were left out", () => {
    render(
      <NutritionBody marked portions={1} recipe={{ ...recipe, extrasCoverage: { sugars: 0.6 } }} />
    );

    expect(screen.getByTestId("nutrition-sugars")).toHaveTextContent("*");
    expect(screen.queryByTestId("nutrition-star-note")).not.toBeInTheDocument();
  });

  it("shows a dash, not zero, for a partial value that rounds to nothing", () => {
    render(
      <NutritionBody
        portions={1}
        recipe={{
          ...recipe,
          nutritionExtras: { saturatedFat: 0.01, sugars: 0 },
          extrasCoverage: { saturatedFat: 0.3 },
        }}
      />
    );

    expect(screen.getByTestId("nutrition-saturatedFat")).toHaveTextContent("—");
    // A value every line knew is a real zero.
    expect(screen.getByTestId("nutrition-sugars")).toHaveTextContent("0g");
  });

  it("draws no sub-rows or More nutrients for a recipe that knows none of them", () => {
    render(
      <NutritionBody portions={1} recipe={{ calories: 400, fat: 10, carbs: 10, protein: 10 }} />
    );

    expect(screen.queryByTestId("nutrition-sugars")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nutrition-more-toggle")).not.toBeInTheDocument();
  });
});
