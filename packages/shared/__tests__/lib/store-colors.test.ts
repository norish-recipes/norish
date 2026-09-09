import { describe, expect, it } from "vitest";

import { StoreColorSchema } from "@norish/shared/contracts/zod";
import { STORE_COLOR_KEYS, STORE_HUES, storeHue } from "@norish/shared/lib/store-colors";

describe("STORE_HUES", () => {
  it("has an entry for every stored colour key, and the picker lists exactly those", () => {
    expect(Object.keys(STORE_HUES).sort()).toEqual([...StoreColorSchema.options].sort());
    expect([...STORE_COLOR_KEYS].sort()).toEqual([...StoreColorSchema.options].sort());
  });

  it("gives no two keys the same hue in either theme, so two Stores are never alike", () => {
    const lights = Object.values(STORE_HUES).map((hue) => hue.light.toLowerCase());
    const darks = Object.values(STORE_HUES).map((hue) => hue.dark.toLowerCase());

    expect(new Set(lights).size).toBe(lights.length);
    expect(new Set(darks).size).toBe(darks.length);
  });

  it("names every hue by what it looks like, each name its own", () => {
    const names = Object.values(STORE_HUES).map((hue) => hue.name);

    expect(new Set(names).size).toBe(names.length);
    for (const hue of Object.values(STORE_HUES)) {
      expect(hue.light).toMatch(/^#[0-9a-f]{6}$/i);
      expect(hue.dark).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("storeHue", () => {
  it("reads a Store's colour as stored, and a value it does not know as the brand green", () => {
    expect(storeHue("danger")).toBe(STORE_HUES.danger);
    expect(storeHue("not-a-colour")).toBe(STORE_HUES.primary);
  });
});
