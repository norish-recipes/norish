import { useEffect, useRef } from "react";

import type { ScaledFood } from "./use-lines-to-buy";
import { useLinesToBuy } from "./use-lines-to-buy";

/** Adds what the panel would tick (or sends it to Bring! where that is the list) once the recipe
 * and a fresh Pantry read have answered; an unreadable Pantry opens the panel instead, and
 * `onDone` runs once, as it decides. */
export function useAddAtOnce({
  recipeId,
  servings,
  locale,
  lines,
  linesReady,
  onOpenChange,
  onDone,
}: {
  /** The recipe the lines belong to, and the servings they are scaled to: where the list is Bring!,
   * what it is sent for. An app that omits them sends the lines with no recipe. */
  recipeId?: string;
  servings?: number;
  /** The language units are written in where the list is Bring!. */
  locale?: string;
  /** The recipe's foods to buy, from `useRecipeFoodsToBuy`. */
  lines: ScaledFood[];
  /** Whether the recipe and the recipes it links to have answered. */
  linesReady: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { pantry, toBuy, addLines, isProviderLoading } = useLinesToBuy(
    lines,
    {},
    recipeId !== undefined && servings !== undefined ? { recipeId, servings, locale } : undefined
  );
  const addedRef = useRef(false);
  // The list is known too: the lines must not go to the built-in one on an instance that uses Bring!.
  const ready = linesReady && !pantry.isLoading && !pantry.isFetching && !isProviderLoading;

  useEffect(() => {
    if (!ready || addedRef.current) return;
    addedRef.current = true;
    onDone();
    if (pantry.isUnavailable) onOpenChange(true);
    else if (toBuy.length === 0) onOpenChange(false);
    else void addLines(toBuy).finally(() => onOpenChange(false));
  });
}
