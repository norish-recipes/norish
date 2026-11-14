import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { useNewCookbook } from "../use-new-cookbook";

const state = vi.hoisted(() => ({ createCookbook: vi.fn(), setMembership: vi.fn() }));

vi.mock("../use-cookbooks-mutations", () => ({
  useCookbooksMutations: () => ({
    createCookbook: state.createCookbook,
    setMembership: state.setMembership,
  }),
}));
vi.mock("../use-recipes-query", () => ({
  useRecipesQuery: () => ({
    recipes: [{ id: "r1" }, { id: "r2" }],
    isLoading: false,
    hasMore: false,
    loadMore: vi.fn(),
  }),
}));

const render = (initial?: string[]) =>
  renderHook(() => useNewCookbook(initial), {
    wrapper: createTestWrapper(createTestQueryClient()),
  });

describe("useNewCookbook", () => {
  beforeEach(() => {
    state.createCookbook.mockReset();
    state.setMembership.mockReset();
  });

  it("creates the cookbook with exactly the picked recipes, in one write", () => {
    const { result } = render();

    act(() => result.current.setTitle("  Soups "));
    act(() => result.current.toggle("r1"));
    act(() => result.current.toggle("r2"));
    act(() => result.current.toggle("r1"));
    act(() => void result.current.create());

    expect(state.createCookbook).toHaveBeenCalledExactlyOnceWith({
      title: "Soups",
      recipeIds: ["r2"],
    });
    expect(state.setMembership).not.toHaveBeenCalled();
  });

  it("files nothing when no recipe is picked", () => {
    const { result } = render();

    act(() => result.current.setTitle("Empty"));
    act(() => void result.current.create());

    expect(state.createCookbook).toHaveBeenCalledExactlyOnceWith({
      title: "Empty",
      recipeIds: [],
    });
  });

  it("starts with the recipe it was opened from ticked", () => {
    const { result } = render(["r1"]);

    expect(result.current.selected).toEqual(["r1"]);

    act(() => result.current.setTitle("Quick"));
    act(() => void result.current.create());

    expect(state.createCookbook).toHaveBeenCalledWith({ title: "Quick", recipeIds: ["r1"] });
  });

  it("cannot create without a name", () => {
    const { result } = render();

    expect(result.current.canCreate).toBe(false);

    act(() => result.current.setTitle("   "));
    expect(result.current.canCreate).toBe(false);

    act(() => result.current.setTitle("Soups"));
    expect(result.current.canCreate).toBe(true);
  });
});
