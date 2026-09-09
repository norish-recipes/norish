"use client";

import { useCallback, useEffect, useState } from "react";

import type { StoreDto, StoreProductChoice } from "@norish/shared/contracts";
import { isPendingLink } from "@norish/shared/lib/product-link";

import { useParsedGroceryName } from "./use-parsed-grocery-name";
import { useStorePrices } from "./use-store-prices";
import { useChooseProduct } from "./use-store-products-mutations";
import { useProductLink } from "./use-store-products-query";

/** How long a shopper stops typing a grocery's name before its link is read. */
const LOOKUP_DEBOUNCE_MS = 400;

/**
 * Which of a shop's products a Grocery is, as the grocery panel holds it.
 *
 * Both grocery panels hold exactly this, and both must agree: the field reads
 * whatever the grocery is linked to now, a selection is visible immediately,
 * and it is written only on the panel's own Save or Add, against the name the
 * grocery is saved under, because the Product Link is keyed by that name.
 */
export function useProductChoice(options: {
  /** The raw text of the panel's own field: "2 kg oude kaas". */
  itemName: string;
  stores: StoreDto[];
  selectedStoreId: string | null;
  /** Reopened, or opened on a different grocery: the held choice is not that grocery's. */
  resetOn?: unknown;
}) {
  const { itemName, stores, selectedStoreId, resetOn } = options;
  // What is held is held for one Store and one grocery. Reading it back
  // through that key, rather than clearing it in an effect, means a field
  // mounted for another Store never sees the last Store's choice — not even
  // for the one render an effect would take to clear it, which is the render
  // the field reads its opening state from.
  const [held, setHeld] = useState<{
    storeId: string | null;
    about: unknown;
    choice: StoreProductChoice | null;
  } | null>(null);
  /** Whether what is held is about this Store and this grocery, and so is readable at all. */
  const isCurrent = useCallback(
    (state: { storeId: string | null; about: unknown } | null) =>
      state !== null && state.storeId === selectedStoreId && state.about === resetOn,
    [selectedStoreId, resetOn]
  );
  const current = isCurrent(held) ? held : null;
  const choice = current?.choice ?? null;
  const setChoice = useCallback(
    (next: StoreProductChoice | null) =>
      setHeld({ storeId: selectedStoreId, about: resetOn, choice: next }),
    [selectedStoreId, resetOn]
  );
  const chooseProduct = useChooseProduct();
  const { linkFor } = useStorePrices();
  const groceryName = useParsedGroceryName(itemName);
  const store = stores.find((candidate) => candidate.id === selectedStoreId) ?? null;
  const listLink = linkFor(selectedStoreId, groceryName);
  const onTheList = listLink?.product ?? null;
  // The Store has been asked about this very name and has not answered: the
  // field waits for that answer rather than asking the shop a second time.
  const askedOnTheList = isPendingLink(listLink);
  const [settledName, setSettledName] = useState(groceryName);

  // The name a panel opens on is what it is about, so it is adopted at once;
  // only what is typed after that waits for the typing to stop, because a link
  // is not looked up once per keystroke.
  useEffect(() => {
    if (settledName === "" || groceryName === settledName) {
      setSettledName(groceryName);

      return;
    }
    const timer = setTimeout(() => setSettledName(groceryName), LOOKUP_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [groceryName, settledName]);

  // The list's own prices answer for the Store each grocery sits under and no
  // other, so a Store the shopper has just selected is read on its own.
  const lookup = useProductLink(listLink ? null : selectedStoreId, settledName);
  const linked = onTheList ?? (settledName === groceryName ? (lookup.data?.product ?? null) : null);
  // Whether the link is still being read: the name has not settled yet, the
  // Store is being asked by this screen, or the Store is being asked by the
  // queue — a Pending Link, on the list or read on its own. Until then
  // "nothing linked" is not an answer, and the field must not treat it as
  // one — by searching the shop for a name that may well be linked, or by
  // taking a product for it.
  const linkPending =
    !onTheList &&
    Boolean(selectedStoreId) &&
    (askedOnTheList ||
      settledName !== groceryName ||
      lookup.isLoading ||
      isPendingLink(lookup.data));

  const commit = useCallback(() => {
    // Committed or not, the choice is spent: the panel that stays open for the
    // next grocery must not still be holding this one's product.
    const chosen = choice;

    setHeld(null);
    if (!chosen || !selectedStoreId || !groceryName) return;
    // An untouched field has nothing to say: only a choice the user actually
    // made is written, and never over the same product it already pointed at.
    if (chosen.kind === "product" && chosen.storeProductId === linked?.id) {
      return;
    }
    void chooseProduct(selectedStoreId, groceryName, chosen);
  }, [choice, chooseProduct, groceryName, linked, selectedStoreId]);

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
