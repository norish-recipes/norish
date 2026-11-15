import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StoreDto } from "@norish/shared/contracts";
import { editingStoreOf, newEditingStore, useSaveStore } from "@norish/shared-react/groceries";

const stores = vi.hoisted(() => ({
  createStore: vi.fn(),
  updateStore: vi.fn(),
  checkSearchAddress: vi.fn(),
  showError: vi.fn(),
}));

vi.mock("../use-stores-mutations", () => ({ useStoresMutations: () => stores }));
vi.mock("../../platform", () => ({ usePlatform: () => ({ showError: stores.showError }) }));

const held: StoreDto = {
  id: "s1",
  userId: "u",
  name: "AH",
  color: "primary",
  website: "https://www.ah.nl",
  searchAddress: null,
  sortOrder: 0,
  version: 1,
  aisles: [],
};

describe("useSaveStore", () => {
  beforeEach(() => {
    for (const fn of Object.values(stores)) fn.mockReset();
    stores.createStore.mockResolvedValue("new-id");
    stores.checkSearchAddress.mockResolvedValue({ outcome: "products", count: 3 });
  });

  it("creates a Store and asks the shop about its new link", async () => {
    const { result } = renderHook(() => useSaveStore([held]));
    let saved = false;

    await act(async () => {
      saved = await result.current.save({
        ...newEditingStore(),
        name: " Lidl ",
        link: "https://www.lidl.nl",
      });
    });

    expect(saved).toBe(true);
    expect(stores.createStore).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Lidl", website: "https://www.lidl.nl", aisles: [] })
    );
    expect(stores.checkSearchAddress).toHaveBeenCalledWith(
      "new-id",
      null,
      null,
      "https://www.lidl.nl"
    );
    expect(result.current.shopCheck?.result).toEqual({ outcome: "products", count: 3 });
  });

  it("keeps the editor open when the create is refused", async () => {
    stores.createStore.mockRejectedValue(new Error("no"));
    const { result } = renderHook(() => useSaveStore([]));
    let saved = true;

    await act(async () => {
      saved = await result.current.save({ ...newEditingStore(), name: "Lidl" });
    });

    expect(saved).toBe(false);
    expect(stores.showError).toHaveBeenCalledWith(expect.any(Error), "stores:create");
  });

  it("re-saving the link a Store has asks the shop nothing", async () => {
    const { result } = renderHook(() => useSaveStore([held]));

    await act(async () => {
      await result.current.save({ ...editingStoreOf(held), name: "Albert Heijn" });
    });

    expect(stores.updateStore).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s1", name: "Albert Heijn" })
    );
    expect(stores.checkSearchAddress).not.toHaveBeenCalled();
  });
});
