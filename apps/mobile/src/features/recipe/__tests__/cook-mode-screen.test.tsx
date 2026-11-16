// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => ({ recipe: null as object | null, error: null as unknown }));
const back = vi.hoisted(() => vi.fn());
const flings = vi.hoisted(
  () => [] as { direction: number; enabled?: boolean; onActivate: () => void }[]
);
const STEPS = ["Chop.", "Fry.", "Serve."].map((step, order) => ({ step, order, images: [] }));
const RECIPE = { id: "r1", name: "Stew", categories: [], steps: STEPS, recipeIngredients: [] };

type Props = { testID?: string; children?: ReactNode; onPress?: () => void };
const host = ({ testID, children, onPress }: Props) => (
  <div data-testid={testID} onClick={onPress}>
    {children}
  </div>
);

vi.mock("react-native", () => ({
  View: host,
  Text: host,
  Pressable: host,
  ScrollView: host,
  Image: host,
  StyleSheet: { absoluteFill: {} },
}));
vi.mock("react-native-gesture-handler", () => ({
  Directions: { RIGHT: 1, LEFT: 2, UP: 4, DOWN: 8 },
  GestureDetector: ({ children }: Props) => children,
  useFlingGesture: (config: (typeof flings)[number]) => {
    flings.push(config);

    return config;
  },
  useCompetingGestures: () => ({}),
}));
vi.mock("react-native-reanimated", () => import("../../../../__tests__/mocks/reanimated"));
vi.mock("expo-haptics", () => ({ impactAsync: () => {}, ImpactFeedbackStyle: { Light: 0 } }));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/components/glass", () => ({
  GlassCloseButton: ({ testID, onPress }: Props) => (
    <button data-testid={testID} type="button" onClick={onPress} />
  ),
}));
vi.mock("@/hooks/use-resolved-color-scheme", () => ({ useResolvedColorScheme: () => "light" }));
vi.mock("@/hooks/use-category-label", () => ({ useCategoryLabel: () => String }));
vi.mock("@/lib/network/server-url", () => ({ useServerImage: () => () => null }));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "missing" }),
  useRouter: () => ({ back }),
}));
vi.mock("heroui-native", () => ({ useThemeColor: (names: string[]) => names }));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@trpc/client", () => ({
  TRPCClientError: class TRPCClientError extends Error {
    data = { code: "NOT_FOUND" };
  },
}));
vi.mock("@norish/shared-react/ingredients", () => ({ useIngredientIcons: () => {} }));
vi.mock("@norish/shared-react/reader", () => ({ useDevicePreference: () => ["plain"] }));
vi.mock("@norish/shared-react/recipes", () => ({
  useRecipeQuery: () => query,
  useLoadedPageRecipe: () => RECIPE,
  resolveCookingModeSteps: (steps: unknown[]) => steps,
  clampStep: (step: number, count: number) => Math.min(Math.max(step, 0), count - 1),
  useRecipePageStore: (select: (state: object) => unknown) =>
    select({ wakeLock: "off", setWakeLock: () => {} }),
}));
vi.mock("../components/cook-bar", () => ({
  BAR_BOTTOM: 0,
  BAR_HEIGHT: 0,
  CookBar: ({ onViewChange }: { onViewChange: (view: string) => void }) => (
    <button
      data-testid="cook-ingredients-tab"
      type="button"
      onClick={() => onViewChange("ingredients")}
    />
  ),
}));
vi.mock("../components/cook-ingredients", () => ({
  CookIngredients: () => <div data-testid="cook-ingredients" />,
}));
vi.mock("../components/cook-steps", () => ({
  CROSSFADE_IN: {},
  CROSSFADE_OUT: {},
  CookSteps: ({ current }: { current: number }) => <div data-testid="cook-step">{current}</div>,
}));
vi.mock("../components/fade-edge", () => ({ FadeEdge: () => null }));
vi.mock("../components/timer-list", () => ({ TimerList: () => null }));
vi.mock("../components/tint", () => ({ TintContext: ({ children }: Props) => children }));
vi.mock("../utils/dish-tint", () => ({ dishTint: () => null }));

const { TRPCClientError } = await import("@trpc/client");
const { CookModeScreen } = await import("../screens/cook-mode-screen");

describe("CookModeScreen's vertical fling", () => {
  beforeEach(() => {
    query.recipe = RECIPE;
    flings.length = 0;
  });

  it("goes back to the steps from Ingredients and pages there", () => {
    render(<CookModeScreen />);
    fireEvent.click(screen.getByTestId("cook-ingredients-tab"));
    const up = flings.findLast((fling) => fling.direction === 4);

    expect(up?.enabled ?? true).toBe(true);
    act(() => up?.onActivate());

    expect(screen.getByTestId("cook-step").textContent).toBe("1");
  });
});

describe("CookModeScreen before its recipe loads", () => {
  beforeEach(() => {
    query.recipe = null;
    query.error = null;
    back.mockClear();
  });

  it("closes while the recipe is still loading, offline without it too", () => {
    render(<CookModeScreen />);

    fireEvent.click(screen.getByTestId("cook-close"));

    expect(back).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("recipe-not-found")).toBeNull();
  });

  it("shows the Recipe screen's not-found state for a deleted recipe, and closes", () => {
    query.error = new TRPCClientError("gone");
    render(<CookModeScreen />);

    expect(screen.getByTestId("recipe-not-found")).toBeTruthy();
    fireEvent.click(screen.getByTestId("cook-close"));
    expect(back).toHaveBeenCalledTimes(1);
  });
});
