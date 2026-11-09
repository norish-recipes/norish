import { beforeEach, describe, expect, it } from "vitest";

import type { GroceryDto } from "@norish/shared/contracts";
import { useGroceriesUiStore } from "@norish/shared-react/groceries";

const MILK: GroceryDto = {
  id: "g1",
  version: 1,
  name: "milk",
  amount: null,
  unit: null,
  isDone: false,
  recipeIngredientId: null,
  recurringGroceryId: null,
  storeId: null,
  sortOrder: 0,
};

const ui = () => useGroceriesUiStore.getState();

describe("useGroceriesUiStore", () => {
  beforeEach(() => ui().reset());

  it("starts with every panel closed", () => {
    expect(ui()).toMatchObject({
      addGroceryPanelOpen: false,
      editingGrocery: null,
      storeManagerOpen: false,
    });
  });

  it("opens and closes each panel on its own", () => {
    ui().setAddGroceryPanelOpen(true);
    ui().setStoreManagerOpen(true);
    ui().setEditingGrocery(MILK);

    expect(ui()).toMatchObject({
      addGroceryPanelOpen: true,
      editingGrocery: MILK,
      storeManagerOpen: true,
    });

    ui().setStoreManagerOpen(false);
    ui().setEditingGrocery(null);

    expect(ui()).toMatchObject({
      addGroceryPanelOpen: true,
      editingGrocery: null,
      storeManagerOpen: false,
    });
  });

  it("closes every panel on reset, as the screen leaves", () => {
    ui().setAddGroceryPanelOpen(true);
    ui().setStoreManagerOpen(true);
    ui().setEditingGrocery(MILK);

    ui().reset();

    expect(ui()).toMatchObject({
      addGroceryPanelOpen: false,
      editingGrocery: null,
      storeManagerOpen: false,
    });
  });
});
