// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import "../../../../__tests__/mocks/content-setup";

const held = vi.hoisted(() => ({
  router: { dismissAll: vi.fn(), push: vi.fn() },
  uses: {} as Record<string, unknown>,
  loadMore: vi.fn(),
  retry: vi.fn(),
}));

vi.mock("expo-router", () => ({
  useRouter: () => held.router,
  useLocalSearchParams: () => ({ kind: "tag", id: "e1" }),
}));
vi.mock("@norish/shared-react/lists", () => ({
  useEntryRecipes: () => ({
    recipes: [{ id: "r1", name: "Soup" }],
    loaded: true,
    failed: false,
    retry: held.retry,
    hasMore: false,
    loadingMore: false,
    loadMore: held.loadMore,
    ...held.uses,
  }),
}));

const { ContentUsesScreen } = await import("../screens/content-uses-screen");

describe("ContentUsesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    held.uses = {};
  });

  it("opens a recipe from the Settings stack's own place in the tabs", () => {
    render(<ContentUsesScreen />);
    fireEvent.click(screen.getByTestId("content-uses-r1"));
    expect(held.router.dismissAll).toHaveBeenCalled();
    expect(held.router.push).toHaveBeenCalledWith({
      pathname: "/recipe/[id]",
      params: { id: "r1" },
    });
  });

  it("pages: Show more asks for the next page", () => {
    held.uses = { hasMore: true };
    render(<ContentUsesScreen />);
    fireEvent.click(screen.getByTestId("content-uses-more"));
    expect(held.loadMore).toHaveBeenCalled();
  });

  it("is a skeleton while loading, says nothing uses it, and a failed read retries", () => {
    held.uses = { loaded: false, recipes: [] };
    const first = render(<ContentUsesScreen />);

    expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
    first.unmount();
    held.uses = { recipes: [] };
    const second = render(<ContentUsesScreen />);

    expect(screen.getByTestId("content-uses-empty")).toBeTruthy();
    second.unmount();
    held.uses = { loaded: false, failed: true, recipes: [] };
    render(<ContentUsesScreen />);
    fireEvent.click(screen.getByTestId("content-uses-retry"));
    expect(held.retry).toHaveBeenCalled();
  });
});
