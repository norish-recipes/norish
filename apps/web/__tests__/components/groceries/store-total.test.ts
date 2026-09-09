/** What is still to buy at one Store, added up for its heading. */
import { lineOf, lineOfGroup, storeTotal } from "@/components/groceries/store-total";
import { describe, expect, it } from "vitest";

import type { GroceryDto, StoreProductDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";

function grocery(
  name: string,
  isDone: boolean,
  amount: number | null = null,
  unit: string | null = null
): GroceryDto {
  return { id: name, name, isDone, amount, unit, storeId: "store-a" } as unknown as GroceryDto;
}

function product(
  price: number,
  currency = "EUR",
  pack: { quantity: number; unit: string; byWeight?: boolean } | null = null
): StoreProductDto {
  return {
    id: `p-${price}`,
    price,
    currency,
    packQuantity: pack?.quantity ?? null,
    packUnit: pack?.unit ?? null,
    packByWeight: pack?.byWeight ?? false,
    packByHand: false,
  } as unknown as StoreProductDto;
}

const PRICES: Record<string, StoreProductDto> = {
  cola: product(1.99),
  melk: product(1.29),
  kaas: product(4.99, "EUR", { quantity: 1, unit: "kilogram" }),
  bloem: product(2.99, "EUR", { quantity: 500, unit: "gram" }),
  bananen: product(1.99, "EUR", { quantity: 1, unit: "kilogram", byWeight: true }),
};

const priceFor = (_storeId: string | null, name: string | null) => PRICES[name ?? ""] ?? null;

function group(groceries: GroceryDto[]): GroceryGroup {
  return {
    groupKey: `store-a|${groceries[0]?.name}`,
    displayName: groceries[0]?.name ?? "",
    normalizedName: groceries[0]?.name ?? "",
    normalizedUnit: "",
    storeId: "store-a",
    aisleId: null,
    totalAmount: null,
    displayUnit: null,
    canAggregate: true,
    sources: groceries.map((item) => ({ grocery: item, recipeName: null })),
    allDone: groceries.every((item) => item.isDone),
    anyDone: groceries.some((item) => item.isDone),
    primaryId: groceries[0]?.id ?? "",
  };
}

describe("storeTotal", () => {
  it("adds up what is still to buy and leaves out what is ticked off", () => {
    const total = storeTotal(
      [grocery("cola", false), grocery("melk", false), grocery("kaas", true)].map(lineOf),
      priceFor,
      "store-a"
    );

    expect(total).toEqual({ amount: 3.28, currency: "EUR" });
  });

  it("counts as many packs as a line's own amount needs", () => {
    const twoKilos = lineOf(grocery("kaas", false, 2, "kg"));
    const total = storeTotal([twoKilos], priceFor, "store-a");

    expect(total?.amount).toBe(9.98);
  });

  it("prices what is sold loose by the weight the line states", () => {
    const total = storeTotal([lineOf(grocery("bananen", false, 700, "gram"))], priceFor, "store-a");

    expect(total?.amount).toBe(1.39);
  });

  it("prices a grouped row from its combined amount, converting through the unit table", () => {
    const flour = group([grocery("bloem", false, 300, "gram"), grocery("bloem", false, 0.4, "kg")]);
    const total = storeTotal([lineOfGroup(flour)], priceFor, "store-a");

    // 700 g of a 500 g pack is two packs: one purchase, not one per recipe.
    expect(total).toEqual({ amount: 5.98, currency: "EUR" });
  });

  it("prices the same two lines as two purchases in the flat list", () => {
    const lines = [grocery("bloem", false, 300, "gram"), grocery("bloem", false, 0.4, "kg")].map(
      lineOf
    );

    expect(storeTotal(lines, priceFor, "store-a")?.amount).toBe(5.98);
  });

  it("counts one pack for a line it cannot reconcile, rather than nothing", () => {
    const total = storeTotal([lineOf(grocery("bloem", false, 2, "liter"))], priceFor, "store-a");

    expect(total?.amount).toBe(2.99);
  });

  it("has nothing to say for a Store that could price none of it", () => {
    expect(storeTotal([lineOf(grocery("ansjovis", false))], priceFor, "store-a")).toBeNull();
    expect(storeTotal([lineOf(grocery("cola", true))], priceFor, "store-a")).toBeNull();
  });

  it("has nothing to say for the groceries under no Store at all", () => {
    expect(storeTotal([lineOf(grocery("cola", false))], priceFor, null)).toBeNull();
  });

  it("totals the currency its first priced line is in and no other", () => {
    const mixed: Record<string, StoreProductDto> = {
      cola: product(2, "EUR"),
      tea: product(3, "GBP"),
    };
    const total = storeTotal(
      [grocery("cola", false), grocery("tea", false)].map(lineOf),
      (_storeId, name) => mixed[name ?? ""] ?? null,
      "store-a"
    );

    expect(total).toEqual({ amount: 2, currency: "EUR" });
  });
});
