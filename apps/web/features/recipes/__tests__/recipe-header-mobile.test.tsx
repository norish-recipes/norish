import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import RecipeHeaderMobile from "@/components/recipes/recipe-header-mobile";

vi.mock("@/components/recipes/origin-flag", () => ({
  default: () => <span data-testid="origin-flag" />,
}));
vi.mock("@/components/shared/smart-markdown-renderer", () => ({
  default: ({ text }: { text: string }) => <p>{text}</p>,
}));
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

type HeaderRecipe = Parameters<typeof RecipeHeaderMobile>[0]["recipe"];

const baseRecipe = (): HeaderRecipe => ({
  name: "Cacio e Pepe",
  description: "A Roman classic.",
  categories: ["Dinner"],
  tags: [],
  totalMinutes: 45,
  servings: 2,
  calories: 520,
  originCountry: "IT",
});

const TOTAL_TIME = "recipes.glanceBar.totalTime";
const SERVINGS = "recipes.glanceBar.servings";
const CALORIES = "recipes.nutrition.calories";

function glanceLabels(): string[] {
  return [TOTAL_TIME, SERVINGS, CALORIES].filter((label) => screen.queryByText(label) !== null);
}

/**
 * The Glance Bar restates facts the sections below own and holds none of its
 * own: an entry the recipe does not store is absent, a Hidden Item takes its
 * entry with it, and a recipe storing none of the three has no bar at all.
 */
describe("Glance Bar", () => {
  it("shows total time, servings and calories", () => {
    render(<RecipeHeaderMobile recipe={baseRecipe()} />);

    expect(glanceLabels()).toEqual([TOTAL_TIME, SERVINGS, CALORIES]);
    expect(screen.getByText("45m")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("520")).toBeInTheDocument();
  });

  it("omits the total time a recipe does not store", () => {
    render(<RecipeHeaderMobile recipe={{ ...baseRecipe(), totalMinutes: null }} />);

    expect(glanceLabels()).toEqual([SERVINGS, CALORIES]);
  });

  it("omits the calories a recipe does not store", () => {
    render(<RecipeHeaderMobile recipe={{ ...baseRecipe(), calories: null }} />);

    expect(glanceLabels()).toEqual([TOTAL_TIME, SERVINGS]);
  });

  it("drops the calories entry for a reader who has hidden Nutrition Information", () => {
    render(<RecipeHeaderMobile recipe={baseRecipe()} showCalories={false} />);

    expect(glanceLabels()).toEqual([TOTAL_TIME, SERVINGS]);
  });

  it("keeps a single default serving, because servings is always stored", () => {
    render(
      <RecipeHeaderMobile
        recipe={{ ...baseRecipe(), servings: 1, totalMinutes: null, calories: null }}
      />
    );

    expect(glanceLabels()).toEqual([SERVINGS]);
  });

  it("renders no bar at all when the recipe stores none of the three", () => {
    render(
      <RecipeHeaderMobile
        recipe={{ ...baseRecipe(), totalMinutes: null, servings: null, calories: null }}
      />
    );

    expect(glanceLabels()).toEqual([]);
  });
});

describe("RecipeHeaderMobile", () => {
  it("reads title, description, glance bar, then the filing line", () => {
    render(
      <RecipeHeaderMobile
        allergies={["Nuts"]}
        allergySet={new Set(["nuts"])}
        recipe={{ ...baseRecipe(), tags: [{ name: "Quick" }, { name: "Nuts" }] }}
      />
    );

    const order = [
      screen.getByRole("heading", { name: /Cacio e Pepe/ }),
      screen.getByText("A Roman classic."),
      screen.getByText(TOTAL_TIME),
      screen.getByText(/Quick/),
    ];

    for (let i = 0; i < order.length - 1; i++) {
      expect(
        order[i]!.compareDocumentPosition(order[i + 1]!) & Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
    }
  });

  it("files categories and tags on one quiet line rather than a wall of chips", () => {
    render(
      <RecipeHeaderMobile
        recipe={{ ...baseRecipe(), tags: [{ name: "Quick" }, { name: "Weeknight" }] }}
      />
    );

    expect(screen.getByText("recipes.form.category.dinner, Quick, Weeknight")).toBeInTheDocument();
  });

  it("keeps allergen tags at the front of that line, and marked", () => {
    render(
      <RecipeHeaderMobile
        allergies={["Nuts"]}
        allergySet={new Set(["nuts"])}
        recipe={{ ...baseRecipe(), tags: [{ name: "Quick" }, { name: "Nuts" }] }}
      />
    );

    const line = screen.getByText(/Quick/).textContent ?? "";

    // A warning that reads like the rest of the list is not a warning: it
    // leads the line and it keeps its fill.
    expect(line.indexOf("Nuts")).toBeLessThan(line.indexOf("Quick"));
    expect(screen.getByText("Nuts").className).toContain("bg-warning");
  });

  it("names neither the author nor a source — both belong to the Source card", () => {
    render(<RecipeHeaderMobile recipe={baseRecipe()} />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByText("Nonna")).not.toBeInTheDocument();
  });
});
