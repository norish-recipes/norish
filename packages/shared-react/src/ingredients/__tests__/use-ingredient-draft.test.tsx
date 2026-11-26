import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IngredientItem } from "../types";

const edits = vi.hoisted(() => ({
  saveDraft: vi.fn(),
  markDistinct: vi.fn(),
  moveAlias: vi.fn(),
  merge: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("../use-ingredient-mutations", () => ({ useIngredientMutations: () => edits }));

const { useIngredientDraft } = await import("../use-ingredient-draft");

const item = {
  id: "soy",
  name: "Soy sauce",
  flagged: false,
  parent: null,
  kinds: 0,
  canEdit: true,
  ownIcon: false,
  icon: "/icons/soy.png",
  aliases: [{ id: "a1", text: "sojasaus", canRemove: true }],
} as IngredientItem;

const setUp = (onGone = vi.fn()) => renderHook(() => useIngredientDraft(item, "Soy sauce", onGone));

beforeEach(() => {
  for (const fn of Object.values(edits)) fn.mockReset().mockResolvedValue(true);
});

describe("useIngredientDraft", () => {
  it("is clean until a field changes, and saves the changes as one draft", async () => {
    const { result } = setUp();

    expect(result.current.dirty).toBe(false);
    act(() => result.current.setName("Shoyu"));
    act(() => result.current.setAlias("ketjap"));
    act(() => result.current.stageAlias());
    act(() => result.current.setParent({ id: "sauces", name: "Sauces" }));
    expect(result.current.dirty).toBe(true);
    expect(result.current.spellingCount).toBe(2);
    await act(() => result.current.save());
    expect(edits.saveDraft).toHaveBeenCalledWith({
      ingredientId: "soy",
      name: "Shoyu",
      parent: { id: "sauces", name: "Sauces" },
      add: ["ketjap"],
      remove: [],
      junk: [],
    });
    // The spelling is spent; the name and parent stay until the cache brings the saved food back.
    expect(result.current.added).toEqual([]);
  });

  it("gives a refused draft back as it was typed", async () => {
    edits.saveDraft.mockResolvedValue(false);
    const { result } = setUp();

    act(() => result.current.setName("Shoyu"));
    let saved = true;

    await act(async () => {
      saved = await result.current.save();
    });
    expect(saved).toBe(false);
    expect(result.current.name).toBe("Shoyu");
    expect(result.current.dirty).toBe(true);
  });

  it("stages a spelling's removal for the junk pile, and a second toggle keeps it", () => {
    const { result } = setUp();
    const spelling = item.aliases[0]!;

    act(() => result.current.toggleRemoval(spelling, true));
    expect(result.current.removed.has("a1")).toBe(true);
    expect(result.current.spellingCount).toBe(0);
    act(() => result.current.toggleRemoval(spelling));
    expect(result.current.removed.has("a1")).toBe(false);
  });

  it("files a parent into the draft, but merges and moves go at once", () => {
    const onGone = vi.fn();
    const { result } = setUp(onGone);

    act(() => result.current.saveRelocation({ kind: "parent" }, { id: "sauces", name: "Sauces" }));
    expect(result.current.parent?.id).toBe("sauces");
    expect(edits.merge).not.toHaveBeenCalled();
    act(() => result.current.saveRelocation({ kind: "merge" }, { id: "shoyu", name: "Shoyu" }));
    expect(onGone).toHaveBeenCalled();
    expect(edits.merge).toHaveBeenCalledWith(
      { id: "soy", name: "Soy sauce" },
      { id: "shoyu", name: "Shoyu" }
    );
    act(() =>
      result.current.saveRelocation({ kind: "move", aliasId: "a1", text: "x" }, { id: null })
    );
    expect(edits.moveAlias).toHaveBeenCalledWith("soy", "a1", null);
  });

  it("shows a removed own icon as the placeholder until saved", () => {
    const { result } = setUp();

    expect(result.current.icons).toMatchObject({ shown: "/icons/soy.png", hasOwn: false });
    act(() => result.current.setIcon({ file: "f", address: "/icons/new.png" }));
    expect(result.current.icons).toMatchObject({ shown: "/icons/new.png", hasOwn: true });
  });
});
