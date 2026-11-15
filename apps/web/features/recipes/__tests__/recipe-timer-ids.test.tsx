import { CookingStepView } from "@/features/recipes/components/page/cooking-mode/cooking-step-view";
import { ReadonlyStepsList } from "@/features/recipes/components/read-only/readonly-steps-list";
import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { resolveCookingModeSteps } from "@norish/shared-react/recipes";
import { recipeTimerId } from "@norish/shared-react/recipes/timers";

vi.mock("@norish/shared-react/reader", async () =>
  (await import("@/__tests__/helpers/reader-mock")).mockDevicePreferences()
);
vi.mock("@/features/recipes/components/read-only/smart-instruction", () => ({
  SmartInstruction: ({
    text,
    recipeId,
    stepIndex,
  }: {
    text: string;
    recipeId: string;
    stepIndex: number;
  }) => <span data-timer-id={recipeTimerId(recipeId, stepIndex, 0)}>{text}</span>,
}));
vi.mock("@/components/shared/smart-markdown-renderer", () => ({
  default: ({ text }: { text: string }) => <span>{text}</span>,
}));
vi.mock("@/features/recipes/components/media/image-lightbox", () => ({ default: () => null }));
vi.mock("@/features/recipes/components/page/cooking-mode/step-images", () => ({
  StepImages: () => null,
}));
vi.mock("@norish/shared-react/recipes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/recipes")>()),
  useAmountDisplayPreference: () => ({ mode: "decimal" }),
}));
vi.mock("@/hooks/use-unit-formatter", () => ({
  useUnitFormatter: () => ({ formatUnitOnly: (unit: string | null | undefined) => unit ?? "" }),
}));
vi.mock("next-intl", () => ({
  useLocale: () => "en",
  useTranslations: () => (key: string) => key,
}));

const STEPS = [
  "# Sauce",
  "Simmer for 10 minutes.",
  "Season.",
  "## Pasta",
  "Boil for 8 minutes.",
].map((step, order) => ({ step, systemUsed: "metric", order }));
const TEXTS = STEPS.map((s) => s.step).filter((text) => !text.startsWith("#"));

const timerIds = () => TEXTS.map((text) => screen.getByText(text).getAttribute("data-timer-id"));

describe("Recipe Timer ids on web", () => {
  it("are the same on the recipe page and in cooking mode for a recipe with headings", () => {
    render(
      <ReadonlyStepsList
        enableTimers
        interactive
        recipeId="recipe-1"
        steps={STEPS}
        systemUsed="metric"
      />
    );
    const page = timerIds();

    cleanup();
    render(
      <CookingStepView
        activeStep={0}
        displayIngredients={[]}
        recipe={{
          id: "recipe-1",
          name: "Stew",
          image: null,
          categories: [],
          totalMinutes: 30,
          servings: 2,
          systemUsed: "metric",
        }}
        steps={resolveCookingModeSteps(STEPS, "metric")}
      />
    );

    expect(page).toEqual(["recipe-1-s0-0", "recipe-1-s1-0", "recipe-1-s2-0"]);
    expect(timerIds()).toEqual(page);
  });
});
