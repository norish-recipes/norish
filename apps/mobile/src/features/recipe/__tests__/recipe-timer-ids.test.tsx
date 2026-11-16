// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { cleanup, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { recipeTimerId } from "@norish/shared-react/recipes/timers";

const host = ({ testID, children }: { testID?: string; children?: ReactNode }) => (
  <div data-testid={testID}>{children}</div>
);
const STEPS = [
  "# Sauce",
  "Simmer for 10 minutes.",
  "Season.",
  "## Pasta",
  "Boil for 8 minutes.",
].map((step, order) => ({ step, systemUsed: "metric", order, images: [] }));
const RECIPE = { id: "recipe-1", name: "Stew", systemUsed: "metric", steps: STEPS };

vi.mock("react-native", () => ({
  View: host,
  Text: host,
  Pressable: host,
  ScrollView: host,
  Image: host,
  Modal: host,
  useWindowDimensions: () => ({ width: 400, fontScale: 1 }),
}));
vi.mock("react-native-reanimated", () => import("../../../../__tests__/mocks/reanimated"));
vi.mock("react-native-gesture-handler", () => ({
  GestureDetector: ({ children }: { children: React.ReactNode }) => children,
  Pressable: host,
  useNativeGesture: () => ({}),
  usePanGesture: () => ({}),
}));
vi.mock("react-native-worklets", () => ({ scheduleOnRN: () => {}, scheduleOnUI: () => {} }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("heroui-native", () => ({ useThemeColor: (names: string[]) => names }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ locale: "en", formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@/components/server-image", () => ({ ServerImage: () => null }));
vi.mock("../components/media-viewer", () => ({ MediaViewer: () => null }));
vi.mock("@norish/shared-react/recipes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/recipes")>()),
  useLoadedPageRecipe: () => RECIPE,
  usePageIngredients: () => [],
  useAmountDisplayPreference: () => ({ mode: "decimal" }),
  useUnitFormatter: () => ({ formatUnitOnly: () => "" }),
}));
vi.mock("../components/tint", () => ({ SectionCard: host, useTint: () => null }));
vi.mock("@/components/ingredient-icon", () => ({ IngredientIcon: () => null }));
// Every step has one duration, drawn as a chip that shows the timer id it would start.
vi.mock("../hooks/use-step-timers", () => ({
  useStepTimers: (text: string) => ({ matches: [{ originalText: text }], marked: text }),
}));
vi.mock("../components/inline-markdown", () => ({
  InlineMarkdown: ({ renderTimer }: { renderTimer: (index: number) => ReactNode }) =>
    renderTimer(0),
}));
vi.mock("../components/timer-chip", () => ({
  TimerChip: ({ stepIndex, index }: { stepIndex: number; index: number }) => (
    <span data-testid="timer">{recipeTimerId("recipe-1", stepIndex, index)}</span>
  ),
  TimerChipButton: () => null,
}));

const { StepsSection } = await import("../components/steps-section");
const { CookSteps } = await import("../components/cook-steps");
const { resolveCookingModeSteps } = await import("@norish/shared-react/recipes");

const shownIds = (root: Pick<typeof screen, "getAllByTestId"> = screen) =>
  root.getAllByTestId("timer").map((chip) => chip.textContent);

describe("Recipe Timer ids on mobile", () => {
  it("are the same on the Recipe page and in cook mode for a recipe with headings", () => {
    render(<StepsSection />);
    const page = shownIds();

    cleanup();
    const steps = resolveCookingModeSteps(STEPS, "metric");
    const cook = steps.flatMap((_, current) => {
      render(<CookSteps current={current} steps={steps} onStepChange={() => {}} />);
      // The steps either side are mounted too, posed as peeks; only the current one is read.
      const ids = shownIds(within(screen.getByTestId("cook-step")));

      cleanup();

      return ids;
    });

    expect(page).toEqual(["recipe-1-s0-0", "recipe-1-s1-0", "recipe-1-s2-0"]);
    expect(cook).toEqual(page);
  });
});
