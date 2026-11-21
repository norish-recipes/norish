import { useState } from "react";

import type { StoreDto, StoreProductChoice } from "@norish/shared/contracts";
import { isPendingLink } from "@norish/shared/lib/product-link";

import { useLinkFor } from "./use-store-prices";
import { useChooseProduct } from "./use-store-products-mutations";
import { useProductLink } from "./use-store-products-query";

/** The product choice a grocery panel holds: read from the link, shown at once, written on Save or Add. */
export function useProductChoice(options: {
  /** The grocery as it is saved, parsed from the panel's own field. */
  groceryName: string;
  /** `groceryName` once it has stopped changing. */
  settledName: string;
  /** The Ingredient the name stands for, where Norish knows it yet. */
  ingredientId: string | null | undefined;
  stores: StoreDto[];
  selectedStoreId: string | null;
  /** Reopened, or opened on a different grocery: the held choice is not that grocery's. */
  resetOn?: unknown;
}) {
  const { groceryName, settledName, ingredientId, stores, selectedStoreId, resetOn } = options;
  // Held under its Store and grocery and read back through that key, so another Store's field
  // never sees it, not even for the render an effect would take to clear it.
  const [held, setHeld] = useState<{
    storeId: string | null;
    about: unknown;
    choice: StoreProductChoice | null;
  } | null>(null);
  /** Whether what is held is about this Store and this grocery, and so is readable at all. */
  const isCurrent = (state: { storeId: string | null; about: unknown } | null) =>
    state !== null && state.storeId === selectedStoreId && state.about === resetOn;
  const current = isCurrent(held) ? held : null;
  const choice = current?.choice ?? null;
  const setChoice = (next: StoreProductChoice | null) =>
    setHeld({ storeId: selectedStoreId, about: resetOn, choice: next });
  const chooseProduct = useChooseProduct();
  const store = stores.find((candidate) => candidate.id === selectedStoreId) ?? null;
  const listLink = useLinkFor(selectedStoreId, ingredientId);
  const onTheList = listLink?.product ?? null;
  // The Store was asked about this name and has not answered: wait rather than ask twice.
  const askedOnTheList = isPendingLink(listLink);

  // The list's prices cover each grocery's own Store only; another selected Store is read on its own.
  const lookup = useProductLink(listLink ? null : selectedStoreId, settledName);
  const linked = onTheList ?? (settledName === groceryName ? (lookup.data?.product ?? null) : null);
  // Still read while the name settles, the lookup loads or a Pending Link waits on the queue;
  // until then "nothing linked" is no answer to search or auto-pick on.
  const linkPending =
    !onTheList &&
    Boolean(selectedStoreId) &&
    (askedOnTheList ||
      settledName !== groceryName ||
      lookup.isLoading ||
      isPendingLink(lookup.data));

  const commit = () => {
    // Committed or not, the choice is spent: a panel left open for the next grocery holds none.
    const chosen = choice;

    setHeld(null);
    if (!chosen || !selectedStoreId || !groceryName) return;
    // Only a choice the user made is written, and never the product already linked.
    if (chosen.kind === "product" && chosen.storeProductId === linked?.id) {
      return;
    }
    // Unlinking what was never linked would write a Miss over an answer still coming.
    if (chosen.kind === "none" && !linked) return;
    chooseProduct(selectedStoreId, groceryName, chosen, ingredientId);
  };

  return {
    choice,
    setChoice,
    groceryName,
    store,
    /** What this grocery is linked to now, if anything. */
    linkedProduct: linked,
    /** Whether that is still being read, in which case `linkedProduct` says nothing yet. */
    linkPending,
    commit,
  };
}
