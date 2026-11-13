import { useEffect, useRef } from "react";

import { useLinesToBuy } from "./use-lines-to-buy";

/**
 * Adds what the panel would have ticked, once the recipe has answered and the Pantry was read in
 * this mount, never from a cached copy; a Pantry that cannot be read opens the panel instead
 * (`onOpenChange(true)`). Every other way out closes it. `onDone` runs once, as it decides.
 */
export function useAddAtOnce({
  recipeId,
  initialServings,
  originalServings,
  onOpenChange,
  onDone,
}: {
  recipeId: string;
  initialServings: number;
  originalServings: number;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { isLoading, linkedLoading, pantry, toBuy, addLines } = useLinesToBuy(
    recipeId,
    originalServings,
    initialServings,
    {}
  );
  const addedRef = useRef(false);
  const ready = !isLoading && !linkedLoading && !pantry.isLoading && !pantry.isFetching;

  useEffect(() => {
    if (!ready || addedRef.current) return;
    addedRef.current = true;
    onDone();
    if (pantry.isUnavailable) onOpenChange(true);
    else if (toBuy.length === 0) onOpenChange(false);
    else void addLines(toBuy).finally(() => onOpenChange(false));
  });
}
