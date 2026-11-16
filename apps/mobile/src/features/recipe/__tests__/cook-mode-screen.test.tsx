// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => ({ recipe: null as object | null, error: null as unknown }));
const back = vi.hoisted(() => vi.fn());
const setHostOptions = vi.hoisted(() => vi.fn());

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
vi.mock("react-native-gesture-handler", () => ({}));
vi.mock("react-native-reanimated", () => import("../../../../__tests__/mocks/reanimated"));
vi.mock("expo-haptics", () => ({}));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
vi.mock("@expo/vector-icons/Ionicons", () => ({ default: () => null }));
vi.mock("@/components/glass", () => ({
  GlassCloseButton: ({ testID, onPress }: Props) => (
    <button data-testid={testID} type="button" onClick={onPress} />
  ),
}));
vi.mock("@/hooks/use-resolved-color-scheme", () => ({}));
vi.mock("@/components/server-image", () => ({ ServerImage: () => null }));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "missing" }),
  useRouter: () => ({ back }),
  useNavigation: () => ({ getParent: () => ({ setOptions: setHostOptions }) }),
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
vi.mock("@norish/shared-react/ingredients", () => ({}));
vi.mock("@norish/shared-react/reader", () => ({}));
vi.mock("@norish/shared-react/recipes", () => ({ useRecipeQuery: () => query }));
vi.doMock("../components/cook-bar", () => ({ BAR_BOTTOM: 34, BAR_HEIGHT: 48 }));
for (const path of [
  "../components/cook-ingredients",
  "../components/cook-steps",
  "../components/fade-edge",
  "../components/timer-list",
  "../components/tint",
  "../utils/dish-tint",
]) {
  vi.doMock(path, () => ({}));
}

const { TRPCClientError } = await import("@trpc/client");
const { CookModeScreen } = await import("../screens/cook-mode-screen");

describe("CookModeScreen before its recipe loads", () => {
  beforeEach(() => {
    query.recipe = null;
    query.error = null;
    back.mockClear();
    setHostOptions.mockClear();
  });

  it("turns off the hosting route's back swipe while open, so a swipe never pops cook mode", () => {
    const { unmount } = render(<CookModeScreen />);

    expect(setHostOptions).toHaveBeenLastCalledWith({ gestureEnabled: false });
    unmount();
    expect(setHostOptions).toHaveBeenLastCalledWith({ gestureEnabled: true });
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
