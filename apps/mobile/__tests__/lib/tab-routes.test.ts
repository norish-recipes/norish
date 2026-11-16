import { cookbookIdOf, cookbookRoute, recipeIdOf, recipeRoute } from "@/lib/tab-routes";
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
