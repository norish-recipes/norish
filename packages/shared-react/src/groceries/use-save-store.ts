import { useState } from "react";

import type { StoreDto, StoreSearchAddressResult } from "@norish/shared/contracts";

import type { EditingStore } from "./store-editor";
import { usePlatform } from "../platform";
import { canSaveStore, storeLinkFields } from "./store-editor";
import { useStoresMutations } from "./use-stores-mutations";

/** What the shop said when its Search Address was last tried, if it was. */
export type ShopCheck = { storeName: string; result: StoreSearchAddressResult | null };

/** Saves the Store being edited as web's store manager does: one write with its aisles, a refused
 * create left to try again, and the shop asked about a changed link once the Store is stored. */
export function useSaveStore(stores: StoreDto[]) {
  const { createStore, updateStore, checkSearchAddress } = useStoresMutations();
  const { showError } = usePlatform();
  const [shopCheck, setShopCheck] = useState<ShopCheck | null>(null);

  /** Resolves false where nothing was saved, so the editor stays open on its draft. */
  const save = async (editing: EditingStore): Promise<boolean> => {
    if (!canSaveStore(editing)) return false;

    const { website, searchAddress, term } = storeLinkFields(editing.link);
    const storeName = editing.name.trim();
    // The link it already had asks the shop nothing: it was checked when pasted, and carries no term.
    const before = editing.id ? stores.find((store) => store.id === editing.id) : null;
    const linkChanged =
      !before ||
      (before.website ?? null) !== website ||
      (before.searchAddress ?? null) !== searchAddress;
    // The whole list, in order, each known aisle at the version it was read at (ADR-0004).
    const aisles = editing.aisles.map(({ id, name, version }) => ({
      id,
      name: name.trim(),
      ...(version === undefined ? {} : { version }),
    }));
    let savedId = editing.id;

    if (editing.id) {
      updateStore({
        id: editing.id,
        name: storeName,
        color: editing.color,
        website,
        searchAddress,
        aisles,
      });
    } else {
      const createdId = await createStore({
        name: storeName,
        color: editing.color,
        website,
        searchAddress,
        aisles,
      }).catch((error: unknown) => {
        showError(error, "stores:create");

        return null;
      });

      if (createdId === null) return false;
      savedId = createdId;
    }
    // Verification informs, it never gates: the Store is stored by now.
    if (savedId && (website ?? searchAddress) && linkChanged) {
      setShopCheck({ storeName, result: null });
      checkSearchAddress(savedId, term, searchAddress, website)
        .then((result) => setShopCheck({ storeName, result }))
        .catch(() => setShopCheck(null));
    }

    return true;
  };

  return { save, shopCheck };
}
