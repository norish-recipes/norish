// @vitest-environment jsdom
import type { ReactNode } from "react";
import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => ({ recipe: null as object | null, isLoading: false }));
const params = vi.hoisted(() => ({ current: { id: "r1" } as Record<string, string> }));
const back = vi.hoisted(() => vi.fn());

type Props = { testID?: string; children?: ReactNode; onPress?: () => void };

vi.mock("react-native", () => ({
  View: ({ testID, children }: Props) => <div data-testid={testID}>{children}</div>,
}));
vi.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0 }) }));
vi.mock("@/components/glass", () => ({
  GlassCloseButton: ({ testID, onPress }: Props) => (
    <button data-testid={testID} type="button" onClick={onPress} />
  ),
}));
vi.mock("@/lib/tab-bar-visibility", () => ({ useHideTabBar: () => {} }));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => params.current,
  useRouter: () => ({ back }),
}));
vi.mock("react-intl", () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
vi.mock("@norish/shared-react/recipes", () => ({
  useRecipeQuery: () => query,
  // As the real hook: it throws without a recipe.
  useLoadedPageRecipe: () => {
    if (!query.recipe) throw new Error("Recipe not loaded");

    return query.recipe;
  },
  resolveCookingModeSteps: () => [],
}));
vi.mock("../components/media-viewer", () => ({
  MediaViewer: () => <div data-testid="media-viewer" />,
}));

const { MediaViewerScreen } = await import("../screens/media-viewer-screen");

const recipe = {
  name: "Soup",
  systemUsed: "metric",
  images: [{ image: "/hero.jpg", order: 0 }],
  videos: [],
  steps: [{ order: 1, systemUsed: "metric", images: [] }],
};

describe("the media viewer route", () => {
  beforeEach(() => {
    back.mockClear();
    query.recipe = recipe;
    query.isLoading = false;
    params.current = { id: "r1" };
  });

  it("shows the hero's items", () => {
    render(<MediaViewerScreen />);

    expect(screen.getByTestId("media-viewer")).toBeTruthy();
    expect(back).not.toHaveBeenCalled();
  });

  it("leaves when the step it names has no photos", () => {
    params.current = { id: "r1", step: "1" };
    render(<MediaViewerScreen />);

    expect(back).toHaveBeenCalledOnce();
  });

  it("leaves when the step it names does not exist", () => {
    params.current = { id: "r1", step: "9" };
    render(<MediaViewerScreen />);

    expect(back).toHaveBeenCalledOnce();
  });

  it("leaves instead of throwing when the recipe is gone", () => {
    query.recipe = null;
    render(<MediaViewerScreen />);

    expect(back).toHaveBeenCalledOnce();
  });

  it("offers a close while the recipe loads behind a cold link", () => {
    query.recipe = null;
    query.isLoading = true;
    render(<MediaViewerScreen />);

    expect(screen.getByTestId("media-viewer-close")).toBeTruthy();
    expect(back).not.toHaveBeenCalled();
  });
});
