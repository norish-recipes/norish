/**
 * The scenarios the Line Cost was argued through, as one table. A pack is
 * whole and rounded up strictly; a bare number is packs unless the shop
 * counts the pack in pieces; what is sold loose is priced by weight; and a
 * line the arithmetic cannot do costs one pack with the note.
 */
import { describe, expect, it } from "vitest";

import type { PackSize } from "@norish/shared/lib/pack-size";
import { groupLineCost, lineCost } from "@norish/shared/lib/line-cost";

const grams = (quantity: number): PackSize => ({ quantity, unit: "gram", byWeight: false });
const litres = (quantity: number): PackSize => ({ quantity, unit: "liter", byWeight: false });
const pieces = (quantity: number): PackSize => ({ quantity, unit: "piece", byWeight: false });
const perKilo: PackSize = { quantity: 1, unit: "kilogram", byWeight: true };

describe("lineCost", () => {
  it("prices five Danio products at five shelf prices when the shop states no pack size", () => {
    expect(lineCost({ amount: 5, unit: null }, { price: 2.99, pack: null })).toEqual({
      cost: 14.95,
      purchaseAmount: 5,
      packs: 5,
      matched: true,
      byWeight: false,
    });
  });

  it("prices an explicit purchase amount without replacing the grocery requirement", () => {
    expect(
      lineCost({ amount: 800, unit: "gram", purchaseAmount: 3 }, { price: 5.25, pack: grams(400) })
    ).toMatchObject({
      cost: 15.75,
      packs: 3,
      matched: true,
    });
  });

  it("clears a purchase override back to the calculated requirement", () => {
    expect(
      lineCost(
        { amount: 800, unit: "gram", purchaseAmount: null },
        { price: 5.25, pack: grams(400) }
      )
    ).toMatchObject({ cost: 10.5, purchaseAmount: 2 });
  });

  it("allows fractional purchase amounts for products sold by weight", () => {
    expect(
      lineCost({ amount: 500, unit: "gram", purchaseAmount: 0.7 }, { price: 1.99, pack: perKilo })
    ).toMatchObject({ cost: 1.39, purchaseAmount: 0.7 });
  });

  it.each([
    [
      "700 g of a 500 g pack",
      { amount: 700, unit: "gram" },
      2.99,
      grams(500),
      { cost: 5.98, packs: 2, matched: true },
    ],
    [
      "1.5 l of a 1 l pack",
      { amount: 1.5, unit: "liter" },
      1.29,
      litres(1),
      { cost: 2.58, packs: 2, matched: true },
    ],
    [
      "2 el olie of a 500 ml bottle",
      { amount: 2, unit: "tablespoon" },
      3.49,
      { quantity: 500, unit: "milliliter", byWeight: false },
      { cost: 3.49, packs: 1, matched: true },
    ],
    [
      "2 cola of a 6 x 33 cl pack",
      { amount: 2, unit: null },
      4.99,
      { quantity: 198, unit: "centiliter", byWeight: false },
      { cost: 9.98, packs: 2, matched: true },
    ],
    [
      "12 eieren of 10 stuks",
      { amount: 12, unit: null },
      2.49,
      pieces(10),
      { cost: 4.98, packs: 2, matched: true },
    ],
    [
      "12 stuks eieren of 10 stuks",
      { amount: 12, unit: "piece" },
      2.49,
      pieces(10),
      { cost: 4.98, packs: 2, matched: true },
    ],
    [
      "3 tomaten of 6 stuks",
      { amount: 3, unit: null },
      1.99,
      pieces(6),
      { cost: 1.99, packs: 1, matched: true },
    ],
    [
      "2 pak melk of 1 l",
      { amount: 2, unit: "pack" },
      1.09,
      litres(1),
      { cost: 2.18, packs: 2, matched: true },
    ],
    [
      "2 pak melk, written in Dutch",
      { amount: 2, unit: "pak" },
      1.09,
      litres(1),
      { cost: 2.18, packs: 2, matched: true },
    ],
    [
      "410 g of ca. 405 g",
      { amount: 410, unit: "gram" },
      4.49,
      grams(405),
      { cost: 8.98, packs: 2, matched: true },
    ],
    [
      "1 kg of a 1000 g pack, which is exactly one",
      { amount: 1, unit: "kilogram" },
      4.49,
      grams(1000),
      { cost: 4.49, packs: 1, matched: true },
    ],
    [
      "0.3 kg of a 300 g pack, which is exactly one",
      { amount: 0.3, unit: "kilogram" },
      2,
      grams(300),
      { cost: 2, packs: 1, matched: true },
    ],
    [
      "2 kg against a 1,5 l pack",
      { amount: 2, unit: "kilogram" },
      1.89,
      litres(1.5),
      { cost: 1.89, packs: 1, matched: false },
    ],
    [
      "30 cola",
      { amount: 30, unit: null },
      1.99,
      litres(1),
      { cost: 1.99, packs: 1, matched: false },
    ],
    [
      "a pinch of salt of a 500 g pack",
      { amount: 1, unit: "pinch" },
      0.79,
      grams(500),
      { cost: 0.79, packs: 1, matched: false },
    ],
    [
      "kaas with no amount, of a 500 g pack",
      { amount: null, unit: null },
      4.99,
      grams(500),
      { cost: 4.99, packs: 1, matched: true },
    ],
    [
      "a product with no Pack Size",
      { amount: 700, unit: "gram" },
      2.99,
      null,
      { cost: 2.99, packs: 1, matched: false },
    ],
  ])("%s", (_scenario, line, price, pack, expected) => {
    expect(lineCost(line, { price, pack })).toMatchObject({ ...expected, byWeight: false });
  });

  it.each([
    [
      "700 g bananen per kg",
      { amount: 700, unit: "gram" },
      1.99,
      { cost: 1.39, matched: true, quantity: { amount: 700, unit: "gram" } },
    ],
    [
      "0.4 kg bananen per kg",
      { amount: 0.4, unit: "kilogram" },
      1.99,
      { cost: 0.8, matched: true, quantity: { amount: 400, unit: "gram" } },
    ],
    [
      "2 bananen per kg, a count against a weight",
      { amount: 2, unit: null },
      1.99,
      { cost: 1.99, matched: false, quantity: { amount: 1000, unit: "gram" } },
    ],
    [
      "kaas with no amount per kg, one kilo",
      { amount: null, unit: null },
      12.5,
      { cost: 12.5, matched: true, quantity: { amount: 1000, unit: "gram" } },
    ],
    [
      "1 l melk per kg, a different family",
      { amount: 1, unit: "liter" },
      1.99,
      { cost: 1.99, matched: false },
    ],
  ])("%s", (_scenario, line, price, expected) => {
    expect(lineCost(line, { price, pack: perKilo })).toMatchObject({
      ...expected,
      packs: 1,
      byWeight: true,
    });
  });

  it("prices per hundred grams as the shop states it", () => {
    const per100g: PackSize = { quantity: 100, unit: "gram", byWeight: true };

    expect(lineCost({ amount: 250, unit: "gram" }, { price: 1.5, pack: per100g })).toMatchObject({
      cost: 3.75,
      matched: true,
      byWeight: true,
    });
  });

  it("adds money as money", () => {
    expect(lineCost({ amount: 3, unit: null }, { price: 1.1, pack: litres(1) }).cost).toBe(3.3);
  });
});

describe("groupLineCost", () => {
  it("adds explicit purchases to the remaining combined recipe requirement", () => {
    expect(
      groupLineCost(
        [
          { amount: 100, unit: "gram", purchaseAmount: 3 },
          { amount: 200, unit: "gram" },
          { amount: 200, unit: "gram" },
        ],
        { price: 2.5, pack: grams(500) }
      )
    ).toMatchObject({ cost: 10, purchaseAmount: 4 });
  });

  it("prices lines that share a family as one combined amount", () => {
    const lines = [
      { amount: 300, unit: "gram" },
      { amount: 0.4, unit: "kilogram" },
    ];

    expect(groupLineCost(lines, { price: 2.99, pack: grams(500) })).toMatchObject({
      cost: 5.98,
      packs: 2,
      matched: true,
    });
  });

  it("adds counts together before dividing by a pack counted in pieces", () => {
    const lines = [
      { amount: 6, unit: null },
      { amount: 6, unit: "piece" },
    ];

    expect(groupLineCost(lines, { price: 2.49, pack: pieces(10) })).toMatchObject({
      cost: 4.98,
      packs: 2,
    });
  });

  it("adds the lines' own packs where the families differ", () => {
    const lines = [
      { amount: 300, unit: "gram" },
      { amount: 2, unit: null },
    ];

    expect(groupLineCost(lines, { price: 2.99, pack: grams(500) })).toMatchObject({
      cost: 8.97,
      packs: 3,
      matched: true,
    });
  });

  it("adds the lines' own packs where one states no amount, and notes what could not be matched", () => {
    const lines = [
      { amount: null, unit: null },
      { amount: 2, unit: "kilogram" },
    ];

    expect(groupLineCost(lines, { price: 1.89, pack: litres(1) })).toMatchObject({
      cost: 3.78,
      packs: 2,
      matched: false,
    });
  });

  it("caps the packs of the summed route too", () => {
    const lines = [
      { amount: 20, unit: null },
      { amount: 5, unit: "piece" },
    ];

    expect(groupLineCost(lines, { price: 1.99, pack: litres(1) })).toMatchObject({
      cost: 1.99,
      packs: 1,
      matched: false,
    });
  });

  it("prices a lone line exactly as the line itself", () => {
    expect(
      groupLineCost([{ amount: 700, unit: "gram" }], { price: 2.99, pack: grams(500) })
    ).toEqual(lineCost({ amount: 700, unit: "gram" }, { price: 2.99, pack: grams(500) }));
  });
});
