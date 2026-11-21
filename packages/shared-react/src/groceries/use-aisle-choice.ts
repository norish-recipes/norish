import { useCallback, useState } from "react";

import type { StoreDto } from "@norish/shared/contracts";

import { useAisleFor, useFileGroceryName } from "./use-store-aisles";

/** The aisle a grocery's name is filed under, as both grocery panels hold it: the Store's until a
 * choice, written on Save or Add (ADR-0031, ADR-0037); swapping the Store drops the choice. */
export function useAisleChoice(options: {
  /** The grocery's name as it will be saved: "oude kaas" out of "2 kg oude kaas". */
  groceryName: string;
  /** The Ingredient the name stands for, where Norish knows it yet. */
  ingredientId: string | null;
  store: StoreDto | null;
  /** Reopened, or opened on a different grocery: the held choice is not that grocery's. */
  resetOn?: unknown;
}) {
  const { groceryName, ingredientId, store, resetOn } = options;
  const storeId = store?.id ?? null;
  const fileGroceryName = useFileGroceryName();
  // Keyed by Store and panel opening, so another Store or a reopened panel reads what the Store
  // remembers, never the last choice, even for one render.
  const [held, setHeld] = useState<{
    storeId: string | null;
    resetToken: unknown;
    aisleId: string | null;
  } | null>(null);

  const current =
    held !== null && held.storeId === storeId && held.resetToken === resetOn ? held : null;

  if (held !== null && !current) setHeld(null);

  // What the Store remembers — an aisle it still has; one removed in the
  // editor is no answer — unless the shopper has chosen otherwise here.
  const remembered = useAisleFor(storeId, ingredientId);
  const aisleId = current ? current.aisleId : remembered;
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
    if (chosen.aisleId === remembered) return;
    fileGroceryName(storeId, { name: groceryName, ingredientId }, chosen.aisleId);
  }, [current, storeId, groceryName, ingredientId, remembered, fileGroceryName]);

  return {
    /** The Store's aisles, when it has any; the field is shown only then. */
    aisles: store?.aisles ?? [],
    aisleId,
    setAisleId,
    commit,
  };
}
