import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/recipes/components/recipes-stack", () => ({ RecipesStack: () => null }));
vi.mock("@/features/search/components/search-root", () => ({ SearchRoot: () => null }));

describe("the Recipes and Search stacks", () => {
  it("anchors each on its page, so a link to a recipe has the list or results under it", async () => {
    const layout = await import("@/app/(tabs)/(recipes,search)/_layout");

    expect(layout.unstable_settings.recipes).toEqual({ anchor: "index" });
    expect(layout.unstable_settings.search).toEqual({ anchor: "search" });
  });
});
