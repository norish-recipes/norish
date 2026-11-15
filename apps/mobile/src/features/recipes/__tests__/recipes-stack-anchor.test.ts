import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/recipes/components/recipes-stack", () => ({ RecipesStack: () => null }));

describe("the Recipes stack", () => {
  it("anchors on the list, so a link to a recipe has the list under it", async () => {
    const layout = await import("@/app/(tabs)/(recipes)/_layout");

    expect(layout.unstable_settings).toEqual({ anchor: "index" });
  });
});
