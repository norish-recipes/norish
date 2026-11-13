import { beforeEach, describe, expect, it } from "vitest";

import { useGroceriesUiStore } from "@norish/shared-react/groceries";

const ui = () => useGroceriesUiStore.getState();

describe("useGroceriesUiStore", () => {
  beforeEach(() => ui().reset());

  it("starts with every panel closed", () => {
    // As created, before any test's reset.
    expect(useGroceriesUiStore.getInitialState()).toMatchObject({
      addGroceryPanelOpen: false,
      editingGroceryId: null,
      storeManagerOpen: false,
    });
  });

  it("opens and closes each panel on its own", () => {
    ui().setAddGroceryPanelOpen(true);
    ui().setStoreManagerOpen(true);
    ui().setEditingGroceryId("g1");

    expect(ui()).toMatchObject({
      addGroceryPanelOpen: true,
      editingGroceryId: "g1",
      storeManagerOpen: true,
    });

    ui().setStoreManagerOpen(false);
    ui().setEditingGroceryId(null);

    expect(ui()).toMatchObject({
      addGroceryPanelOpen: true,
      editingGroceryId: null,
      storeManagerOpen: false,
    });
  });

  it("closes every panel on reset, as the screen leaves", () => {
    ui().setAddGroceryPanelOpen(true);
    ui().setStoreManagerOpen(true);
    ui().setEditingGroceryId("g1");

    ui().reset();

    expect(ui()).toMatchObject({
      addGroceryPanelOpen: false,
      editingGroceryId: null,
      storeManagerOpen: false,
    });
  });
});
