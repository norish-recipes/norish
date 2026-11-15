import { describe, expect, it } from "vitest";

import en from "@norish/i18n/messages/en/groceries.json";
import { STORE_HUES } from "@norish/shared/lib/store-colors";

describe("the hue table and the picker's words", () => {
  it("has a word in the locale for every hue's name, and no word without a hue", () => {
    // The picker labels a swatch by `colorNames.<name>`; the table's names and
    // the locale's keys are kept in step here, since nothing else ties them.
    const names = Object.values(STORE_HUES)
      .map((hue) => hue.name)
      .sort();

    expect(Object.keys(en.storeManager.colorNames).sort()).toEqual(names);
  });
});
