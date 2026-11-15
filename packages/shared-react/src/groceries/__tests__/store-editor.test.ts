import { describe, expect, it } from "vitest";

import type { StoreDto } from "@norish/shared/contracts";
import {
  addedAisle,
  aisleDraftState,
  canSaveStore,
  editingStoreOf,
  newEditingStore,
  removedAisle,
  renamedAisle,
  storeLinkFields,
} from "@norish/shared-react/groceries";

const store: StoreDto = {
  id: "s1",
  userId: "u",
  name: "Albert Heijn",
  color: "success",
  website: "https://www.ah.nl",
  searchAddress: "https://www.ah.nl/zoeken?query={query}",
  sortOrder: 0,
  version: 3,
  aisles: [
    { id: "a2", storeId: "s1", name: "Bread", sortOrder: 1, version: 2 },
    { id: "a1", storeId: "s1", name: "Fruit", sortOrder: 0, version: 1 },
  ],
};

describe("store editor", () => {
  it("opens a Store on its search address and its aisles in walking order", () => {
    const editing = editingStoreOf(store);

    expect(editing.link).toBe(store.searchAddress);
    expect(editing.aisles.map((aisle) => aisle.id)).toEqual(["a1", "a2"]);
    expect(editing.aisles[0]).toEqual({ id: "a1", name: "Fruit", version: 1 });
  });

  it("saves only with a name, a readable link and distinct aisle names", () => {
    const base = { ...newEditingStore(), name: "Lidl" };

    expect(canSaveStore(newEditingStore())).toBe(false);
    expect(canSaveStore(base)).toBe(true);
    expect(canSaveStore({ ...base, link: "not a link at all" })).toBe(false);
    expect(canSaveStore({ ...base, link: "https://www.lidl.nl" })).toBe(true);
    expect(
      canSaveStore({
        ...base,
        aisles: [
          { id: "1", name: "Dairy" },
          { id: "2", name: " dairy " },
        ],
      })
    ).toBe(false);
    expect(canSaveStore({ ...base, aisles: [{ id: "1", name: " " }] })).toBe(false);
  });

  it("reads a pasted homepage as a website and a pasted search as an address", () => {
    expect(storeLinkFields("https://www.ah.nl")).toMatchObject({
      searchAddress: null,
      term: null,
    });
    expect(storeLinkFields("https://www.ah.nl/zoeken?query=melk")).toMatchObject({
      searchAddress: "https://www.ah.nl/zoeken?query={query}",
      term: "melk",
    });
    expect(storeLinkFields("nonsense")).toEqual({ website: null, searchAddress: null, term: null });
  });

  it("adds, renames and removes aisles, refusing a name the Store has", () => {
    const aisles = [{ id: "a1", name: "Fruit" }];

    expect(aisleDraftState(aisles, "FRUIT")).toMatchObject({ canAdd: false, duplicate: true });
    expect(addedAisle(aisles, "fruit")).toBe(aisles);
    expect(addedAisle(aisles, " Bread ").map((aisle) => aisle.name)).toEqual(["Fruit", "Bread"]);
    expect(
      aisleDraftState(renamedAisle([...aisles, { id: "a2", name: "x" }], "a2", "fruit"), "")
    ).toMatchObject({ listDuplicate: true });
    expect(removedAisle(aisles, "a1")).toEqual([]);
  });
});
