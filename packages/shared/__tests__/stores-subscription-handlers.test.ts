import { describe, expect, it } from "vitest";

import { createStoresSubscriptionHandlers } from "@norish/shared/react/hooks";

type Store = {
  id: string;
  sortOrder: number;
  name: string;
};

describe("createStoresSubscriptionHandlers", () => {
  it("applies onCreated payloads to cache state", () => {
    let current: Store[] | undefined = [{ id: "a", sortOrder: 2, name: "A" }];
    const setStoresData = (updater: (previous: Store[] | undefined) => Store[] | undefined) => {
      current = updater(current);
    };

    const handlers = createStoresSubscriptionHandlers({ setStoresData });

    handlers.onCreated({ store: { id: "b", sortOrder: 1, name: "B" } });

    expect(current?.map((store) => store.id)).toEqual(["b", "a"]);
  });

  it("applies onDeleted payloads to cache state", () => {
    let current: Store[] | undefined = [
      { id: "a", sortOrder: 1, name: "A" },
      { id: "b", sortOrder: 2, name: "B" },
    ];
    const setStoresData = (updater: (previous: Store[] | undefined) => Store[] | undefined) => {
      current = updater(current);
    };

    const handlers = createStoresSubscriptionHandlers({ setStoresData });

    handlers.onDeleted({ storeId: "a" });

    expect(current?.map((store) => store.id)).toEqual(["b"]);
  });
});
