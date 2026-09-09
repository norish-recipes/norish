"use client";

import { useCallback, useEffect, useState } from "react";

import type { StoreDto } from "@norish/shared/contracts";

import { useFileGroceryName, useStoreAisles } from "./use-store-aisles";

/**
 * Which aisle a grocery's name is filed under, as the grocery panel holds it.
 *
 * Both grocery panels hold exactly this, and both agree: the field reads what
 * the chosen Store remembers for the name, a choice is visible at once, and
 * it is written only on the panel's own Save or Add, against the name the
 * grocery is saved under, because the Aisle Link is keyed by that name
 * (ADR-0031). Swapping the Store drops the choice: an aisle of one shop is
 * nowhere in another.
 */
export function useAisleChoice(options: {
  /** The grocery's name as it will be saved: "oude kaas" out of "2 kg oude kaas". */
  groceryName: string;
  store: StoreDto | null;
  /** Reopened, or opened on a different grocery: the held choice is not that grocery's. */
  resetOn?: unknown;
}) {
  const { groceryName, store, resetOn } = options;
  const storeId = store?.id ?? null;
  const { aisleFor } = useStoreAisles();
  const fileGroceryName = useFileGroceryName();
  // Held for one Store and one opening of the panel. It is read back through
  // that key, so a field mounted for another Store never sees the last
  // Store's choice for even one render — and let go the moment either
  // changes, so a Store swapped away from and back, or a panel closed and
  // reopened, reads what the Store remembers rather than a stale choice.
  const [held, setHeld] = useState<{
    storeId: string | null;
    resetToken: unknown;
    aisleId: string | null;
  } | null>(null);

  useEffect(() => {
    setHeld(null);
  }, [storeId, resetOn]);

  const current =
    held !== null && held.storeId === storeId && held.resetToken === resetOn ? held : null;
  // What the Store remembers — an aisle it still has; one removed in the
  // editor is no answer — unless the shopper has chosen otherwise here.
  const remembered = useCallback(() => {
    const filedUnder = aisleFor(storeId, groceryName);

    return filedUnder !== null && store?.aisles.some((aisle) => aisle.id === filedUnder)
      ? filedUnder
      : null;
  }, [aisleFor, storeId, groceryName, store]);
  const aisleId = current ? current.aisleId : remembered();
  const setAisleId = useCallback(
    (next: string | null) => setHeld({ storeId, resetToken: resetOn, aisleId: next }),
    [storeId, resetOn]
  );

  const commit = useCallback(() => {
    // Committed or not, the choice is spent: the panel that stays open for the
    // next grocery must not still be holding this one's aisle.
    const chosen = current;

    setHeld(null);
    if (!chosen || !storeId || !groceryName) return;
    // Only a choice that differs from what the Store remembered is written.
    if (chosen.aisleId === remembered()) return;
    fileGroceryName(storeId, groceryName, chosen.aisleId);
  }, [current, storeId, groceryName, remembered, fileGroceryName]);

  return {
    /** The Store's aisles, when it has any; the field is shown only then. */
    aisles: store?.aisles ?? [],
    aisleId,
    setAisleId,
    commit,
  };
}
