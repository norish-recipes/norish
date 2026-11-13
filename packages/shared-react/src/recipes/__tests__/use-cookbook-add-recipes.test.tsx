import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { useCookbookAddRecipes } from "../use-cookbook-add-recipes";

const state = vi.hoisted(() => ({
  setMembership: vi.fn(),
  asked: [] as unknown[],
  recipes: [] as { id: string }[],
  memberIds: [] as string[],
  membersLoading: false,
}));

vi.mock("../use-cookbooks-mutations", () => ({
  useCookbooksMutations: () => ({ setMembership: state.setMembership }),
}));
vi.mock("../use-recipes-query", () => ({
  useRecipesQuery: (filters: unknown) => {
    state.asked.push(filters);

    return { recipes: state.recipes, isLoading: false, hasMore: false, loadMore: vi.fn() };
  },
}));
vi.mock("../use-cookbook-member-ids-query", () => ({
  useCookbookMemberIdsQuery: () => ({
    memberIds: state.memberIds,
    isLoading: state.membersLoading,
  }),
}));

const cookbook = { id: "cb-1", title: "Weeknights" } as CookbookSummaryDTO;
const render = () =>
  renderHook(() => useCookbookAddRecipes(cookbook), {
    wrapper: createTestWrapper(createTestQueryClient()),
  });

describe("useCookbookAddRecipes", () => {
  beforeEach(() => {
    state.setMembership.mockReset();
    state.asked = [];
    state.recipes = [{ id: "r1" }, { id: "r2" }, { id: "r3" }];
    state.memberIds = ["r2"];
    state.membersLoading = false;
  });

  it("offers only what the cookbook does not hold", () => {
    const { result } = render();

    expect(result.current.addable.map((recipe) => recipe.id)).toEqual(["r1", "r3"]);
    expect(result.current.hasRecipes).toBe(true);
  });

  it("tells a cookbook that holds everything apart from a search that found nothing", () => {
    state.memberIds = ["r1", "r2", "r3"];
    const { result } = render();

    expect(result.current.addable).toEqual([]);
    expect(result.current.hasRecipes).toBe(true);
  });

  it("is loading until the member ids arrive", () => {
    state.membersLoading = true;

    expect(render().result.current.isLoading).toBe(true);
  });

  it("searches on the trimmed text while the field keeps what was typed", () => {
    const { result } = render();

    act(() => result.current.setInput("  curry "));

    expect(result.current.input).toBe("  curry ");
    expect(state.asked.at(-1)).toEqual({ search: "curry" });
  });

  it("stages ticks, and files the picks into the cookbook on save", () => {
    const { result } = render();

    act(() => result.current.toggle("r1"));
    act(() => result.current.toggle("r3"));
    act(() => result.current.toggle("r1"));
    expect(result.current.selected).toEqual(["r3"]);
    act(() => result.current.save());

    expect(state.setMembership).toHaveBeenCalledWith({
      cookbookId: "cb-1",
      recipeIds: ["r3"],
      isMember: true,
      cookbook,
    });
  });
});
