/** Membership commits on Save: a tapped toggle isn't written until then, and a cookbook asked for
 * shows in the list it was asked for in, not only on the server. */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { useCookbookMembership } from "../use-cookbook-membership";

const spies = vi.hoisted(() => ({
  setMembership: vi.fn(),
  createCookbook: vi.fn(),
}));

const EDITABLE = [
  { id: "cookbook-1", title: "Weeknights", containsRecipe: false },
  { id: "cookbook-2", title: "Meal prep", containsRecipe: true },
];

vi.mock("../use-recipe-cookbooks-query", () => ({
  useEditableCookbooksQuery: () => ({ cookbooks: EDITABLE, isLoading: false }),
}));
vi.mock("../use-cookbooks-mutations", () => ({
  useCookbooksMutations: () => ({
    setMembership: spies.setMembership,
    createCookbook: spies.createCookbook,
  }),
}));
vi.mock("../use-cookbooks-subscription", () => ({ useCookbooksSubscription: () => undefined }));

const render = (onSaved?: () => void) =>
  renderHook(() => useCookbookMembership({ recipeIds: ["recipe-1"], onSaved }), {
    wrapper: createTestWrapper(createTestQueryClient()),
  });

describe("useCookbookMembership", () => {
  beforeEach(() => {
    spies.setMembership.mockReset();
    spies.createCookbook.mockReset().mockResolvedValue("new-id");
  });

  it("writes nothing until Save", async () => {
    const { result } = render();

    act(() => result.current.toggle("cookbook-1", true));
    expect(spies.setMembership).not.toHaveBeenCalled();
    expect(result.current.isMember("cookbook-1")).toBe(true);

    await act(() => result.current.save(() => {}));

    expect(spies.setMembership).toHaveBeenCalledTimes(1);
    expect(spies.setMembership).toHaveBeenCalledWith(
      expect.objectContaining({ cookbookId: "cookbook-1", recipeIds: ["recipe-1"], isMember: true })
    );
  });

  it("forgets a toggle that was tapped back to where it started", () => {
    const { result } = render();

    act(() => result.current.toggle("cookbook-1", true));
    act(() => result.current.toggle("cookbook-1", false));

    expect(result.current.isDirty).toBe(false);
  });

  it("creates nothing from a title that was never added", () => {
    const { result } = render();

    act(() => result.current.setNewTitle("Christmas"));

    // Adding the row is the confirmation step, so Save has nothing to do.
    expect(result.current.isDirty).toBe(false);
    expect(result.current.pending).toEqual([]);
  });

  it("shows a cookbook asked for in the list, and creates it on Save", async () => {
    const onSaved = vi.fn();
    const { result } = render(onSaved);

    act(() => result.current.setNewTitle("  Christmas "));
    act(() => result.current.stageNew());

    expect(result.current.pending.map((entry) => entry.title)).toEqual(["Christmas"]);
    expect(result.current.newTitle).toBe("");
    expect(result.current.isDirty).toBe(true);
    expect(spies.createCookbook).not.toHaveBeenCalled();

    await act(() => result.current.save(() => {}));

    expect(spies.createCookbook).toHaveBeenCalledWith({
      title: "Christmas",
      recipeIds: ["recipe-1"],
    });
    expect(onSaved).toHaveBeenCalledWith([{ id: "new-id", title: "Christmas" }]);
  });

  it("closes once the ticks are written, before the new cookbooks are made", async () => {
    const order: string[] = [];

    spies.setMembership.mockImplementation(() => order.push("tick"));
    spies.createCookbook.mockImplementation(async () => {
      order.push("create");

      return "new-id";
    });
    const { result } = render();

    act(() => result.current.toggle("cookbook-2", false));
    act(() => result.current.setNewTitle("Soups"));
    act(() => result.current.stageNew());
    await act(() => result.current.save(() => order.push("close")));

    expect(order).toEqual(["tick", "close", "create"]);
  });

  it("drops a cookbook asked for by mistake", () => {
    const { result } = render();

    act(() => result.current.setNewTitle("Oops"));
    act(() => result.current.stageNew());
    act(() => result.current.unstage(result.current.pending[0]!.key));

    expect(result.current.pending).toEqual([]);
  });
});
