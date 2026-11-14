import { describe, expect, it } from "vitest";

import { dishTint } from "../utils/dish-tint";

describe("dishTint", () => {
  it("tints nothing without a Dish Colour or with an unreadable one", () => {
    expect(dishTint(null, "light")).toBeNull();
    expect(dishTint("orange", "dark")).toBeNull();
  });

  it("hands back hex colours that differ per scheme", () => {
    const light = dishTint("#a66329", "light")!;
    const dark = dishTint("#a66329", "dark")!;

    for (const colour of [...Object.values(light), ...Object.values(dark)]) {
      expect(colour).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(light.page).not.toBe(dark.page);
  });

  it("warms an orange dish's page toward red and away from blue", () => {
    const { page } = dishTint("#a66329", "light")!;
    const [r, , b] = [1, 3, 5].map((at) => parseInt(page.slice(at, at + 2), 16));

    expect(r).toBeGreaterThan(b!);
  });

  it("gives a grey dish no hue", () => {
    const { page } = dishTint("#808080", "light")!;

    expect(page.slice(1, 3)).toBe(page.slice(3, 5));
  });
});
