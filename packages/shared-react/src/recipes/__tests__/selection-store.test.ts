import { beforeEach, describe, expect, it } from "vitest";

import type { SelectedRecipe } from "@norish/shared-react/recipes";
import { useRecipeSelection } from "@norish/shared-react/recipes";

const selection = () => useRecipeSelection.getState();
const selectedIds = () => [...selection().selected.keys()];

const recipe = (id: string, version = 1): SelectedRecipe => ({ id, version, userId: "owner" });
/** A page's loaded list, in grid order. */
const PAGE = ["a", "b", "c", "d", "e"].map((id) => recipe(id));

describe("useRecipeSelection", () => {
  beforeEach(() => selection().clear());

  it("starts empty, with no anchor", () => {
    expect(useRecipeSelection.getInitialState()).toMatchObject({ anchor: null });
    expect(useRecipeSelection.getInitialState().selected.size).toBe(0);
  });

  it("toggles a recipe in and out, keeping its id, version and owner", () => {
    selection().toggle({ ...recipe("b", 3), userId: "someone" });

    expect(selection().selected.get("b")).toEqual({ id: "b", version: 3, userId: "someone" });
    expect(selection().anchor).toBe("b");

    selection().toggle(recipe("b", 3));

    expect(selectedIds()).toEqual([]);
    expect(selection().anchor).toBe("b");
  });

  it("selects the range from the anchor, in either direction", () => {
    selection().toggle(PAGE[3]!);
    selection().selectRange(PAGE[1]!, PAGE);

    expect(selectedIds().sort()).toEqual(["b", "c", "d"]);
    // The anchor stays put, so a second Shift-click redraws from the same card.
    expect(selection().anchor).toBe("d");

    selection().selectRange(PAGE[4]!, PAGE);

    expect(selectedIds().sort()).toEqual(["b", "c", "d", "e"]);
  });

  it("toggles instead when there is no anchor on the page", () => {
    selection().selectRange(PAGE[2]!, PAGE);

    expect(selectedIds()).toEqual(["c"]);
    expect(selection().anchor).toBe("c");
  });

  it("clears the selection and its anchor on reset", () => {
    selection().toggle(PAGE[0]!);
    selection().selectRange(PAGE[2]!, PAGE);

    selection().clear();

    expect(selectedIds()).toEqual([]);
    expect(selection().anchor).toBeNull();
  });

  it("lets a deleted recipe leave without touching the rest", () => {
    selection().toggle(PAGE[0]!);
    selection().toggle(PAGE[1]!);
    const before = selection().selected;

    selection().drop(["x"]);
    expect(selection().selected).toBe(before);

    selection().drop(["a", "x"]);
    expect(selectedIds()).toEqual(["b"]);
  });
});
