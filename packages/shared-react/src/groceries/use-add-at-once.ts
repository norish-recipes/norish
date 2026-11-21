import { useEffect, useRef } from "react";

import type { ScaledFood } from "./use-lines-to-buy";
import { useLinesToBuy } from "./use-lines-to-buy";

/** Adds what the panel would tick once the recipe and a fresh Pantry read have answered; an
 * unreadable Pantry opens the panel instead, and `onDone` runs once, as it decides. */
export function useAddAtOnce({
  lines,
  linesReady,
  onOpenChange,
  onDone,
}: {
  /** The recipe's foods to buy, from `useRecipeFoodsToBuy`. */
  lines: ScaledFood[];
  /** Whether the recipe and the recipes it links to have answered. */
  linesReady: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { pantry, toBuy, addLines } = useLinesToBuy(lines, {});
  const addedRef = useRef(false);
  const ready = linesReady && !pantry.isLoading && !pantry.isFetching;

  useEffect(() => {
    if (!ready || addedRef.current) return;
    addedRef.current = true;
    onDone();
    if (pantry.isUnavailable) onOpenChange(true);
    else if (toBuy.length === 0) onOpenChange(false);
    else void addLines(toBuy).finally(() => onOpenChange(false));
  });
}
