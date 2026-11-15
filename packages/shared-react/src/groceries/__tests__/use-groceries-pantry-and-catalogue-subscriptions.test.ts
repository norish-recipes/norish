import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useGroceriesPantryAndCatalogueSubscriptions } from "../use-groceries-pantry-and-catalogue-subscriptions";

const subscribed = vi.hoisted(() => ({ calls: [] as string[] }));

vi.mock("../../config", () => ({
  useIngredientsSubscription: () => subscribed.calls.push("ingredients"),
}));
vi.mock("../use-groceries-subscription", () => ({
  useGroceriesSubscription: () => subscribed.calls.push("groceries"),
}));
vi.mock("../use-pantry-subscription", () => ({
  usePantrySubscription: () => subscribed.calls.push("pantry"),
}));

describe("useGroceriesPantryAndCatalogueSubscriptions", () => {
  it("subscribes to the groceries, the Pantry and the ingredient catalogue", () => {
    renderHook(() => useGroceriesPantryAndCatalogueSubscriptions());

    expect([...subscribed.calls].sort()).toEqual(["groceries", "ingredients", "pantry"]);
  });
});
