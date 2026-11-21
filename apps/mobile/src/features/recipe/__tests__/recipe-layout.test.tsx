// @vitest-environment jsdom
import type { ReactElement, ReactNode } from "react";
import React from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useRecipePageStore } from "@norish/shared-react/recipes";

type Route = { key: string; params: { id: string } };
type ScreenLayout = (props: { route: Route; children: ReactNode }) => ReactElement;

// Expo Router pushes a recipe linked from a recipe page into that page's own stack, and the
// layout's params follow the focused screen: here the linked recipe "b" over the page of "a".
const routes: Route[] = [
  { key: "a-page", params: { id: "a" } },
  { key: "b-page", params: { id: "b" } },
  { key: "b-servings", params: { id: "b" } },
];

vi.mock("expo-router", () => {
  const Stack = ({ screenLayout }: { screenLayout: ScreenLayout }) =>
    routes.map((route) => (
      <React.Fragment key={route.key}>
        {screenLayout({ route, children: <Probe name={route.key} /> })}
      </React.Fragment>
    ));

  Stack.Screen = () => null;

  return { Stack, useLocalSearchParams: () => ({ id: "b" }) };
});
vi.mock("@/components/sheet-options", () => ({
  EDITOR_OPTIONS: {},
  FIT_SHEET_OPTIONS: {},
  SHEET_OPTIONS: {},
}));
vi.mock("@/lib/header-title", () => ({ HEADER_TITLE_STYLE: {} }));
vi.mock("@/lib/shown-recipe", () => ({ useMarkRecipeShown: vi.fn() }));
vi.mock("@norish/shared-react/config", () => ({ useIngredientsSubscription: vi.fn() }));
vi.mock("@norish/shared-react/recipes", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-react/recipes")>()),
  useRecipeEnrichmentSubscription: vi.fn(),
  useRecipeShareSubscription: vi.fn(),
  useRecipeSubscription: vi.fn(),
}));
vi.mock("../components/screen-keep-awake", () => ({ ScreenKeepAwake: () => null }));

const setServings: Record<string, (servings: number) => void> = {};

function Probe({ name }: { name: string }) {
  const recipeId = useRecipePageStore((state) => state.recipeId);
  const servings = useRecipePageStore((state) => state.servings);

  setServings[name] = useRecipePageStore((state) => state.setServings);

  return <span data-testid={name}>{`${recipeId} ${servings ?? "-"}`}</span>;
}

const { RecipeLayout } = await import("../screens/recipe-layout");

describe("a recipe page with another recipe linked over it in its stack", () => {
  it("keeps the covered page on its own recipe", () => {
    render(<RecipeLayout />);

    expect(screen.getByTestId("a-page").textContent).toBe("a -");
    expect(screen.getByTestId("b-page").textContent).toBe("b -");
  });

  it("shares a recipe's store between its page and its sheets only", () => {
    render(<RecipeLayout />);

    act(() => setServings["b-servings"]?.(6));

    expect(screen.getByTestId("b-page").textContent).toBe("b 6");
    expect(screen.getByTestId("a-page").textContent).toBe("a -");
  });
});
