import type { RecipePrintCardProps } from "@/components/recipes/recipe-print-card";
import RecipePrintCard from "@/components/recipes/recipe-print-card";
import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import recipes from "@norish/i18n/messages/en/recipes.json";

const props: RecipePrintCardProps = {
  recipe: {
    id: "recipe-1",
    name: "Bread",
    description: "A simple loaf.",
    notes: "Serve **warm**.",
    url: "https://example.com/bread",
    systemUsed: "metric",
    prepMinutes: 10,
    cookMinutes: 30,
    totalMinutes: 40,
    calories: 200,
    fat: "3",
    carbs: "35",
    protein: "6",
    images: [{ image: "/bread.jpg", order: 0 }],
    steps: [
      { step: "# Dough", order: 0, systemUsed: "metric", stepIngredients: [] },
      {
        step: "**Knead** for 10 minutes.",
        order: 1,
        systemUsed: "metric",
        stepIngredients: [{ ingredientOrder: 1, share: 0.5 }],
      },
      { step: "US instruction", order: 0, systemUsed: "us", stepIngredients: [] },
    ],
  },
  ingredients: [
    { ingredientName: "# Dough", amount: null, unit: null, order: 0, systemUsed: "metric" },
    { ingredientName: "Flour", amount: 800, unit: "g", order: 1, systemUsed: "metric" },
    { ingredientName: "Salt", amount: null, unit: null, order: 2, systemUsed: "metric" },
    { ingredientName: "US flour", amount: 4, unit: "cups", order: 0, systemUsed: "us" },
  ],
  servings: 8,
  includePhoto: true,
  amountMode: "fraction",
  formatUnitOnly: (unit) => unit ?? "",
  timerConfig: { enabled: true, recipeId: "recipe-1", stepIndex: 0 },
};

function renderCard(overrides: Partial<RecipePrintCardProps> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ recipes }}>
      <RecipePrintCard {...props} {...overrides} />
    </NextIntlClientProvider>
  );
}

describe("RecipePrintCard", () => {
  it("uses the recipe page's reconciled total cooking time", () => {
    renderCard({ recipe: { ...props.recipe, totalMinutes: 5 } });
    expect(screen.getByText("total").closest("li")).toHaveTextContent("40m");
  });

  it("prints the selected system and servings with derived step amounts", () => {
    renderCard();
    expect(screen.getByText("8 servings")).toBeInTheDocument();
    const ingredients = screen.getByRole("region", { name: "Ingredients" });
    expect(ingredients).toHaveTextContent("800 g Flour");
    expect(ingredients).toHaveTextContent("Salt");
    const steps = screen.getByRole("region", { name: "Instructions" });
    expect(steps).toHaveTextContent("400 g Flour");
    expect(screen.queryByText("US flour")).not.toBeInTheDocument();
    expect(screen.queryByText("US instruction")).not.toBeInTheDocument();
    expect(within(steps).getByText("Knead").tagName).toBe("STRONG");
    expect(within(steps).getByText("10 minutes").tagName).toBe("STRONG");
    expect(within(steps).queryByRole("button")).not.toBeInTheDocument();
  });

  it("prints stored per-serving nutrition without scaling it to recipe servings", () => {
    renderCard();
    const nutrition = screen.getByRole("region", { name: "Nutrition" });
    expect(nutrition).toHaveTextContent("200 kcal");
    expect(nutrition).toHaveTextContent("3 g");
    expect(nutrition).toHaveTextContent("35 g");
    expect(nutrition).toHaveTextContent("6 g");
  });

  it("allows a photo-free card and omits absent nutrition", () => {
    renderCard({
      includePhoto: false,
      recipe: { ...props.recipe, calories: null, fat: null, carbs: null, protein: null },
    });
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Nutrition" })).not.toBeInTheDocument();
  });

  it("does not highlight durations when timer detection is disabled", () => {
    renderCard({ timerConfig: { ...props.timerConfig, enabled: false } });
    expect(screen.getByText(/for 10 minutes/).querySelector("[data-timer-duration]")).toBeNull();
  });
});
