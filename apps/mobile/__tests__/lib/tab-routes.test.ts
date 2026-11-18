import {
  cookbookIdOf,
  cookbookRoute,
  cookModeRoute,
  cookStepOf,
  mediaViewerRoute,
  recipeIdOf,
  recipeRoute,
  viewerParamsOf,
} from "@/lib/tab-routes";
import { describe, expect, it } from "vitest";

// The path Expo Router shows for a typed href.
const pathOf = ({ pathname, params }: { pathname: string; params: { id: string } }) =>
  pathname.replace("[id]", params.id);

describe("route parses", () => {
  it("reads a recipe back from its page and every route its stack presents", () => {
    for (const route of ["recipe", "servings", "edit", "share"] as const) {
      expect(recipeIdOf(pathOf(recipeRoute("abc", route)))).toBe("abc");
    }
    expect(recipeIdOf("/recipes")).toBeUndefined();
    expect(recipeIdOf("/")).toBeUndefined();
  });

  it("reads a cookbook back from its page only", () => {
    expect(cookbookIdOf(pathOf(cookbookRoute("c1")))).toBe("c1");
    expect(cookbookIdOf("/cookbook-add-recipes")).toBeUndefined();
    expect(cookbookIdOf("/cookbook/c1/more")).toBeUndefined();
  });
});

describe("the viewer route", () => {
  it("reads back the start and the step it was built with", () => {
    for (const step of [undefined, { order: 3 }, { stepNumber: 2 }]) {
      expect(viewerParamsOf(mediaViewerRoute("r1", 4, step).params)).toEqual({ start: 4, step });
    }
  });
});

describe("cookStepOf", () => {
  it("opens the timer's step, and the first step for a timer with none", () => {
    expect(cookStepOf(cookModeRoute("r", 3).params.step)).toBe(3);
    expect(cookStepOf(cookModeRoute("r", 0).params.step)).toBe(0);
    expect(cookStepOf(cookModeRoute("r").params.step)).toBe(0);
  });
});
