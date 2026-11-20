// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GroceryListState } from "../hooks/use-grocery-list-state";

// The page's one scroll, which the switch rides.
const scroll = vi.hoisted(() => {
  let offset = 0;

  return {
    offset: { get: () => offset, set: (to: number) => (offset = to) },
    onScroll: undefined,
    barBottom: 100,
  };
});

vi.mock("react-native", async () => {
  const { createElement } = await import("react");

  return {
    View: ({ children }: { children: React.ReactNode }) => createElement("div", null, children),
  };
});
vi.mock("react-native-reanimated", async () => {
  const reanimated = await import("../../../../__tests__/mocks/reanimated");
  const builder = () => ({ springify: () => builder() });

  return {
    ...reanimated,
    LayoutAnimationConfig: ({ children }: { children: React.ReactNode }) => children,
    SlideInLeft: builder(),
    SlideInRight: builder(),
    SlideOutLeft: builder(),
    SlideOutRight: builder(),
  };
});
vi.mock("@/lib/motion/spring", () => ({ sprung: <T,>(builder: T) => builder }));
vi.mock("@/lib/use-tab-scroll", () => ({ useTabScroll: () => scroll }));
vi.mock("@norish/shared-react/config", () => ({ useIngredientsSubscription: () => undefined }));
vi.mock("@norish/shared-react/groceries", () => ({
  useGroceriesSubscription: () => undefined,
  useStoreAislesSubscription: () => undefined,
  useStorePricesSubscription: () => undefined,
  useStoresSubscription: () => undefined,
}));
// The Pantry's field, as the real hook holds it.
vi.mock("../hooks/use-pantry-screen", async () => {
  const { useState } = await import("react");

  return {
    usePantryScreen: () => {
      const [draft, setDraft] = useState("");

      return { field: { draft, setDraft } };
    },
  };
});
// A tap folds the Markt Store.
vi.mock("../components/grocery-list-section", () => ({
  GroceryListSection: ({ state }: { state: GroceryListState }) => (
    <p
      data-collapsed={[...state.collapsed].join()}
      data-testid="list-section"
      onClick={() => state.setCollapsed(new Set(["markt"]))}
    />
  ),
}));
// A tap types "oil" in the field.
vi.mock("../components/pantry-section", () => ({
  PantrySection: ({
    pantry,
  }: {
    pantry: { field: { draft: string; setDraft: (text: string) => void } };
  }) => (
    <p
      data-draft={pantry.field.draft}
      data-testid="pantry-section"
      onClick={() => pantry.field.setDraft("oil")}
    />
  ),
}));
vi.mock("../components/list-switch", () => ({
  ListSwitch: ({ section, onChange }: { section: string; onChange: (to: string) => void }) => (
    <button
      data-section={section}
      data-testid="switch"
      onClick={() => onChange(section === "list" ? "pantry" : "list")}
    />
  ),
}));

const { GroceriesScreen } = await import("../screens/groceries-screen");
const { showGroceriesSection } = await import("@/lib/groceries-section");

describe("the Groceries page", () => {
  beforeEach(() => {
    act(() => showGroceriesSection("list"));
    scroll.offset.set(0);
  });

  it("mounts only the shown section, the switch swapping one for the other", () => {
    render(<GroceriesScreen />);

    expect(screen.getByTestId("list-section")).not.toBeNull();
    expect(screen.queryByTestId("pantry-section")).toBeNull();
    expect(screen.getByTestId("switch").getAttribute("data-section")).toBe("list");

    fireEvent.click(screen.getByTestId("switch"));

    expect(screen.getByTestId("pantry-section")).not.toBeNull();
    expect(screen.queryByTestId("list-section")).toBeNull();

    fireEvent.click(screen.getByTestId("switch"));

    expect(screen.getByTestId("list-section")).not.toBeNull();
  });

  it("starts the switch at the top with the new section, which opens at its top", () => {
    render(<GroceriesScreen />);
    scroll.offset.set(30);

    fireEvent.click(screen.getByTestId("switch"));

    expect(scroll.offset.get()).toBe(0);
  });

  it("starts the switch at the top when a link shows the Pantry", () => {
    render(<GroceriesScreen />);
    scroll.offset.set(30);

    act(() => showGroceriesSection("pantry"));

    expect(scroll.offset.get()).toBe(0);
  });

  it("keeps the list's folds and the Pantry's field across switches", () => {
    render(<GroceriesScreen />);

    fireEvent.click(screen.getByTestId("list-section"));
    fireEvent.click(screen.getByTestId("switch"));
    fireEvent.click(screen.getByTestId("pantry-section"));
    fireEvent.click(screen.getByTestId("switch"));

    expect(screen.getByTestId("list-section").getAttribute("data-collapsed")).toBe("markt");

    fireEvent.click(screen.getByTestId("switch"));

    expect(screen.getByTestId("pantry-section").getAttribute("data-draft")).toBe("oil");
  });

  it("keeps its section across a remount", () => {
    const { unmount } = render(<GroceriesScreen />);

    fireEvent.click(screen.getByTestId("switch"));
    unmount();
    render(<GroceriesScreen />);

    expect(screen.getByTestId("pantry-section")).not.toBeNull();
  });
});
