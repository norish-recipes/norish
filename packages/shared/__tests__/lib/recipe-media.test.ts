// @vitest-environment node
/**
 * The one definition of the image a recipe leads with: the first gallery
 * image by order. Every thumbnail reader resolves through this.
 */
import { describe, expect, it } from "vitest";

import { primaryRecipeImage } from "@norish/shared/lib/recipe-media";

describe("primaryRecipeImage", () => {
  it("leads with the first gallery image by order, whatever the array order", () => {
    expect(
      primaryRecipeImage({
        images: [
          { image: "/recipes/r/second.jpg", order: 2 },
          { image: "/recipes/r/first.jpg", order: 0 },
        ],
      })
    ).toBe("/recipes/r/first.jpg");
  });

  it("returns null when the gallery is empty", () => {
    expect(primaryRecipeImage({ images: [] })).toBeNull();
    expect(primaryRecipeImage({})).toBeNull();
  });

  it("treats an unparseable order as 0, like the carousel does", () => {
    expect(
      primaryRecipeImage({
        images: [
          { image: "/recipes/r/odd.jpg", order: "not-a-number" },
          { image: "/recipes/r/late.jpg", order: 5 },
        ],
      })
    ).toBe("/recipes/r/odd.jpg");
  });
});
