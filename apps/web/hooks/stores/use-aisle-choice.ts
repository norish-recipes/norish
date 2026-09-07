"use client";

import { useCallback, useState } from "react";

import type { StoreDto } from "@norish/shared/contracts";

import { useFileName, useStoreAisles } from "./use-store-aisles";

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
  const fileName = useFileName();
  // Held for one Store and one grocery, read back through that key rather
  // than cleared in an effect, so a field mounted for another Store never
  // sees the last Store's choice for even one render.
  const [held, setHeld] = useState<{
    storeId: string | null;
    about: unknown;
    aisleId: string | null;
  } | null>(null);
  const current = held !== null && held.storeId === storeId && held.about === resetOn ? held : null;
  const remembered = aisleFor(storeId, groceryName);
  // What the Store remembers, unless the shopper has chosen otherwise here.
  const aisleId = current ? current.aisleId : remembered;
  const setAisleId = useCallback(
    (next: string | null) => setHeld({ storeId, about: resetOn, aisleId: next }),
    [storeId, resetOn]
  );

  const commit = useCallback(() => {
    // Committed or not, the choice is spent: the panel that stays open for the
    // next grocery must not still be holding this one's aisle.
    const chosen = current;

    setHeld(null);
    if (!chosen || !storeId || !groceryName) return;
    // Only a choice that differs from what the Store remembered is written.
    if (chosen.aisleId === aisleFor(storeId, groceryName)) return;
    fileName(storeId, groceryName, chosen.aisleId);
  }, [current, storeId, groceryName, aisleFor, fileName]);

  return {
    /** The Store's aisles, when it has any; the field is shown only then. */
    aisles: store?.aisles ?? [],
    aisleId,
    setAisleId,
    commit,
  };
}
