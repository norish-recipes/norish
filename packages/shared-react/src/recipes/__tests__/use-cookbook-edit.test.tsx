import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CookbookSummaryDTO } from "@norish/shared/contracts";
import { createTestQueryClient, createTestWrapper } from "@norish/shared-react/platform/testing";

import { cookbookEditPlan, useCookbookEdit } from "../use-cookbook-edit";

const spies = vi.hoisted(() => ({
  updateCookbook: vi.fn(),
  uploadCookbookImage: vi.fn(),
  setMembership: vi.fn(),
  removeMember: vi.fn(),
  offline: false,
}));

vi.mock("../use-cookbooks-mutations", () => ({
  useCookbooksMutations: () => ({
    updateCookbook: spies.updateCookbook,
    uploadCookbookImage: spies.uploadCookbookImage,
    setMembership: spies.setMembership,
  }),
}));
vi.mock("../use-cookbook-recipes-query", () => ({
  useCookbookRecipesQuery: () => ({ removeMember: spies.removeMember }),
}));
vi.mock("../../offline/react", () => ({ useConnectivity: () => ({ isOffline: spies.offline }) }));

const cookbook = {
  id: "cb-1",
  title: "Weeknights",
  version: 3,
  image: "/covers/old.png",
} as CookbookSummaryDTO;

const render = () =>
  renderHook(() => useCookbookEdit(cookbook), {
    wrapper: createTestWrapper(createTestQueryClient()),
  });

describe("cookbookEditPlan", () => {
  const staged = { title: "Weeknights", removed: [], hasCover: false, clearImage: false };

  it("is clean until something is staged", () => {
    expect(cookbookEditPlan(cookbook, staged).isDirty).toBe(false);
    expect(cookbookEditPlan(cookbook, { ...staged, title: "  Weeknights " }).isDirty).toBe(false);
  });

  it("ignores a blank title and clearing a cookbook that has no cover", () => {
    expect(cookbookEditPlan(cookbook, { ...staged, title: "   " }).isDirty).toBe(false);
    expect(
      cookbookEditPlan({ ...cookbook, image: null }, { ...staged, clearImage: true }).isDirty
    ).toBe(false);
  });

  it("is dirty for a new title, a cover, a cleared cover or a removal", () => {
    expect(cookbookEditPlan(cookbook, { ...staged, title: "Suppers" }).titleChanged).toBe(true);
    expect(cookbookEditPlan(cookbook, { ...staged, hasCover: true }).imageChanged).toBe(true);
    expect(cookbookEditPlan(cookbook, { ...staged, clearImage: true }).imageChanged).toBe(true);
    expect(cookbookEditPlan(cookbook, { ...staged, removed: ["r1"] }).isDirty).toBe(true);
  });
});

describe("useCookbookEdit", () => {
  beforeEach(() => {
    for (const spy of Object.values(spies)) if (typeof spy === "function") spy.mockReset();
    spies.offline = false;
  });

  it("writes nothing for an edit that changes nothing", async () => {
    const { result } = render();

    await act(() => result.current.save());

    expect(spies.updateCookbook).not.toHaveBeenCalled();
    expect(spies.setMembership).not.toHaveBeenCalled();
  });

  it("uploads the cover, then renames and unfiles, in that order", async () => {
    const order: string[] = [];

    spies.uploadCookbookImage.mockImplementation(async () => {
      order.push("upload");

      return "/covers/new.png";
    });
    spies.updateCookbook.mockImplementation(() => order.push("update"));
    spies.setMembership.mockImplementation(() => order.push("membership"));
    spies.removeMember.mockImplementation(() => order.push("remove"));
    const file = new Blob(["x"]);
    const { result } = render();

    act(() => {
      result.current.setTitle(" Suppers ");
      result.current.pickCover({ file, preview: "blob:1" });
      result.current.toggleRemoved("r1");
    });
    expect(result.current.isDirty).toBe(true);
    expect(result.current.shownImage).toBe("blob:1");
    await act(() => result.current.save());

    expect(spies.uploadCookbookImage).toHaveBeenCalledWith("cb-1", file);
    expect(spies.updateCookbook).toHaveBeenCalledWith({
      id: "cb-1",
      title: "Suppers",
      image: "/covers/new.png",
      version: 3,
    });
    expect(spies.setMembership).toHaveBeenCalledWith({
      cookbookId: "cb-1",
      recipeIds: ["r1"],
      isMember: false,
      cookbook,
    });
    expect(order).toEqual(["upload", "update", "membership", "remove"]);
  });

  it("toggles a removal back and forth", () => {
    const { result } = render();

    act(() => result.current.toggleRemoved("r1"));
    expect(result.current.removed).toEqual(["r1"]);
    act(() => result.current.toggleRemoved("r1"));
    expect(result.current.removed).toEqual([]);
  });

  it("clears the cover to the member mosaic, keeping the title", async () => {
    const { result } = render();

    act(() => result.current.clearCover());
    expect(result.current.shownImage).toBeNull();
    await act(() => result.current.save());

    expect(spies.updateCookbook).toHaveBeenCalledWith({
      id: "cb-1",
      title: "Weeknights",
      image: null,
      version: 3,
    });
  });

  it("saves a cover handed to save at once, and says so when the upload fails", async () => {
    spies.uploadCookbookImage.mockRejectedValueOnce(new Error("no"));
    const { result } = render();
    let saved = true;

    await act(async () => {
      saved = await result.current.save(new Blob(["x"]));
    });

    expect(saved).toBe(false);
    expect(spies.updateCookbook).not.toHaveBeenCalled();
    expect(result.current.isSaving).toBe(false);
  });

  it("keeps the cover off while Offline", () => {
    spies.offline = true;

    expect(render().result.current.coverDisabled).toBe(true);
  });
});
