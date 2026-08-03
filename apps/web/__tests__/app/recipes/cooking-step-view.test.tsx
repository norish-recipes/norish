import { render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { CookingStepView } from "@/app/(app)/recipes/[id]/components/cookingmode/cooking-step-view";

beforeAll(() => {
  // HeroUI's ScrollShadow measures itself; jsdom has no ResizeObserver.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
});

vi.mock("@/components/recipe/smart-instruction", () => ({
  SmartInstruction: ({ text }: { text: string }) => <span>{text}</span>,
}));
vi.mock("@/app/(app)/recipes/[id]/components/cookingmode/step-images", () => ({
  StepImages: () => null,
}));
vi.mock("@/hooks/use-amount-display-preference", () => ({
  useAmountDisplayPreference: () => ({ mode: "decimal" }),
}));
vi.mock("@/hooks/use-unit-formatter", () => ({
  useUnitFormatter: () => ({
    formatUnitOnly: (unit: string | null | undefined) => unit ?? "",
  }),
}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

const INGREDIENTS = [
  { ingredientName: "water", amount: 50, unit: "ml", systemUsed: "metric", order: 0 },
  { ingredientName: "flour", amount: 300, unit: "g", systemUsed: "metric", order: 1 },
];

describe("CookingStepView Step Ingredients", () => {
  it("presents the active step's ingredients with resolved amounts", () => {
    render(
      <CookingStepView
        activeStep={0}
        displayIngredients={INGREDIENTS}
        recipeId="recipe-1"
        recipeName="Stew"
        recipeSystemUsed="metric"
        steps={[
          {
            originalIndex: 0,
            stepNumber: 1,
            text: "Add half the water.",
            images: [],
            stepIngredients: [{ ingredientOrder: 0, share: 0.5, order: 0 }],
          },
        ]}
        onStepChange={() => undefined}
      />
    );

    // The information is in front of the cook exactly when hands are full.
    expect(screen.getByText("25 ml water")).toBeInTheDocument();
  });

  it("shows nothing extra for a step that uses nothing", () => {
    render(
      <CookingStepView
        activeStep={0}
        displayIngredients={INGREDIENTS}
        recipeId="recipe-1"
        recipeName="Stew"
        recipeSystemUsed="metric"
        steps={[
          {
            originalIndex: 0,
            stepNumber: 1,
            text: "Serve.",
            images: [],
            stepIngredients: [],
          },
        ]}
        onStepChange={() => undefined}
      />
    );

    expect(screen.getByText("Serve.")).toBeInTheDocument();
    expect(screen.queryByText(/water|flour/)).not.toBeInTheDocument();
  });
});
