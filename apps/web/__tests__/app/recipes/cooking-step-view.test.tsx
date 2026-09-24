import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import "@testing-library/jest-dom";

import { CookingStepView } from "@/app/(app)/recipes/[id]/components/cookingmode/cooking-step-view";

beforeEach(() => {
  vi.clearAllMocks();
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
vi.mock("motion/react", async () => {
  const actual = await vi.importActual("motion/react");
  return {
    ...actual,
    useReducedMotion: () => false,
  };
});

const INGREDIENTS = [
  { ingredientName: "water", amount: 50, unit: "ml", systemUsed: "metric", order: 0 },
  { ingredientName: "flour", amount: 300, unit: "g", systemUsed: "metric", order: 1 },
];

const STEPS = [
  { originalIndex: 0, stepNumber: 1, text: "Boil the water.", images: [], stepIngredients: [] },
  {
    originalIndex: 1,
    stepNumber: 2,
    text: "Add half the water.",
    images: [],
    stepIngredients: [{ ingredientOrder: 0, share: 0.5, order: 0 }],
  },
  { originalIndex: 2, stepNumber: 3, text: "Serve at once.", images: [], stepIngredients: [] },
];

function stepTree(activeStep: number, handlers: Record<string, () => void> = {}) {
  return (
    <CookingStepView
      activeStep={activeStep}
      displayIngredients={INGREDIENTS}
      recipe={{
        id: "recipe-1",
        name: "Stew",
        image: null,
        categories: [],
        totalMinutes: 30,
        servings: 2,
        systemUsed: "metric",
      }}
      steps={STEPS}
      onStepChange={handlers.onStepChange as any}
    />
  );
}

function renderStep(activeStep: number, handlers: Record<string, () => void> = {}) {
  return render(stepTree(activeStep, handlers));
}

describe("CookingStepView Step Ingredients", () => {
  it("presents the active step's ingredients with resolved amounts", () => {
    renderStep(1);

    expect(screen.getByText("25 ml water")).toBeInTheDocument();
  });
});

describe("CookingStepView discrete scroll layout", () => {
  it("renders only the visible window of steps", () => {
    renderStep(1);

    expect(screen.getByText("Boil the water.")).toBeInTheDocument();
    expect(screen.getByText("Add half the water.")).toBeInTheDocument();
    expect(screen.getByText("Serve at once.")).toBeInTheDocument();
  });

  it("renders all steps", () => {
    renderStep(0);

    expect(screen.getByText("Boil the water.")).toBeInTheDocument();
    expect(screen.getByText("Add half the water.")).toBeInTheDocument();
    expect(screen.getByText("Serve at once.")).toBeInTheDocument();
  });

  it("handles wheel event to go to next step", () => {
    const onStepChange = vi.fn();
    const { container } = renderStep(1, { onStepChange });

    fireEvent.wheel(container.firstChild!, { deltaY: 50 });
    expect(onStepChange).toHaveBeenCalledWith(2);
  });

  it("handles wheel event to go to previous step", () => {
    const onStepChange = vi.fn();
    const { container } = renderStep(1, { onStepChange });

    fireEvent.wheel(container.firstChild!, { deltaY: -50 });
    expect(onStepChange).toHaveBeenCalledWith(0);
  });

  it("carries no step number of its own, because the bottom bar counts", () => {
    renderStep(1);
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("handles touch swipe gestures to change step", () => {
    const onStepChange = vi.fn();
    const { container } = renderStep(1, { onStepChange });

    // Swipe down (implies scrolling up, so prev step)
    fireEvent.touchStart(container.firstChild!, { touches: [{ clientY: 100 }] });
    fireEvent.touchEnd(container.firstChild!, { changedTouches: [{ clientY: 200 }] }); // deltaY: +100
    expect(onStepChange).toHaveBeenCalledWith(0);

    onStepChange.mockClear();

    // Swipe up (implies scrolling down, so next step)
    fireEvent.touchStart(container.firstChild!, { touches: [{ clientY: 200 }] });
    fireEvent.touchEnd(container.firstChild!, { changedTouches: [{ clientY: 100 }] }); // deltaY: -100
    expect(onStepChange).toHaveBeenCalledWith(2);
  });

  it("ignores touch swipes below the 50px threshold", () => {
    const onStepChange = vi.fn();
    const { container } = renderStep(1, { onStepChange });

    // Swipe down but only 40px
    fireEvent.touchStart(container.firstChild!, { touches: [{ clientY: 100 }] });
    fireEvent.touchEnd(container.firstChild!, { changedTouches: [{ clientY: 140 }] }); // deltaY: +40

    expect(onStepChange).not.toHaveBeenCalled();
  });

  it("blocks swipe if inner step content is scrollable and not at edge", () => {
    const onStepChange = vi.fn();
    renderStep(1, { onStepChange });

    // Find the active step's scrollable container
    const scrollables = document.querySelectorAll(".can-scroll-natively");
    const activeScrollable = scrollables[0]; // the only one rendered with this class is the active step

    // Mock the layout geometry of the scrollable container
    Object.defineProperty(activeScrollable, "scrollTop", { value: 50, configurable: true });
    Object.defineProperty(activeScrollable, "clientHeight", { value: 100, configurable: true });
    Object.defineProperty(activeScrollable, "scrollHeight", { value: 300, configurable: true });

    // Swipe up. The scrollable is at scrollTop 50 (not at bottom 200). It should NOT trigger a step change.
    fireEvent.touchStart(activeScrollable, { touches: [{ clientY: 200 }] });
    fireEvent.touchEnd(activeScrollable, { changedTouches: [{ clientY: 100 }] });

    expect(onStepChange).not.toHaveBeenCalled();

    Object.defineProperty(activeScrollable, "scrollTop", { value: 200, configurable: true }); // 200 + 100 = 300 (at edge)
    fireEvent.touchStart(activeScrollable, { touches: [{ clientY: 200 }] });
    fireEvent.touchEnd(activeScrollable, { changedTouches: [{ clientY: 100 }] });

    expect(onStepChange).toHaveBeenCalledWith(2);
  });
});
