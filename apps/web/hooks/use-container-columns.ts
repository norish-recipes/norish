import { useMemo } from "react";
import { useWindowSize } from "usehooks-ts";

/**
 * Hook to get responsive column count based on window width.
 * Uses Tailwind-style breakpoints (lg: 1024px).
 *
 * @returns Current column count (2 phone and tablet, 4 desktop)
 */
export function useContainerColumns(): number {
  const { width = 1024 } = useWindowSize();

  return useMemo(() => {
    if (width < 1024) return 2;

    return 4;
  }, [width]);
}
