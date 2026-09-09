import { buildStoreSections, storeTintColor } from "@/lib/groceries/grocery-utils";
import { describe, expect, it } from "vitest";

import type { GroceryDto, StoreDto } from "@norish/shared/contracts";
import { STORE_HUES } from "@norish/shared/lib/store-colors";

function store(id: string, color: string, sortOrder = 0): StoreDto {
  return { id, name: id, color, sortOrder, aisles: [] } as unknown as StoreDto;
}

function grocery(id: string, storeId: string | null): GroceryDto {
  return { id, name: id, storeId, isDone: false, sortOrder: 0 } as unknown as GroceryDto;
}

describe("storeTintColor", () => {
  it("draws a Store in the hue the web draws it, in the hex for the scheme in force", () => {
    expect(storeTintColor(store("dirk", "danger"), "light")).toBe(STORE_HUES.danger.light);
    expect(storeTintColor(store("dirk", "danger"), "dark")).toBe(STORE_HUES.danger.dark);
  });

  it("reads a colour it does not know as the brand green", () => {
    expect(storeTintColor(store("old", "purple"), "light")).toBe(STORE_HUES.primary.light);
  });
});

describe("buildStoreSections", () => {
  const sections = buildStoreSections({
    groceries: [grocery("a", null), grocery("b", "sky"), grocery("c", "primary")],
    stores: [store("sky", "sky", 1), store("primary", "primary", 0)],
    recipeMap: {},
    scheme: "light",
  });

  it("tints Unsorted grey, which no Store's colour is confused with", () => {
    expect(sections[0]?.id).toBe("unsorted");
    expect(sections[0]?.tintColor).toBe(STORE_HUES.slate.light);
  });

  it("gives two Stores two hues, so the phone tells them apart", () => {
    const tints = sections.slice(1).map((section) => section.tintColor);

    expect(tints).toEqual([STORE_HUES.primary.light, STORE_HUES.sky.light]);
    expect(new Set(tints).size).toBe(2);
  });
});
