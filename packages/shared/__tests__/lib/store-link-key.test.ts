import { describe, expect, it } from "vitest";

import { aisleLinkKey, productLinkKey } from "@norish/shared/lib/store-link-key";

describe("productLinkKey", () => {
  it("spells the one key every Product Link map uses: a Store and an Ingredient", () => {
    expect(productLinkKey("store-a", "ingredient-1")).toBe("store-a|ingredient-1");
  });

  it("is the key of an Aisle Link too", () => {
    expect(aisleLinkKey("store-a", "ingredient-1")).toBe(productLinkKey("store-a", "ingredient-1"));
  });
});
