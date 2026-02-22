import type { VirtualItem } from "@tanstack/react-virtual";

import { useCallback } from "react";

// Store scroll state outside component lifecycle
interface ScrollState {
  scrollOffset: number;
  measurementsCache: VirtualItem[];
}

const scrollStateStore = new Map<string, ScrollState>();

export function useScrollRestoration(filterKey: string) {
  const saveScrollState = useCallback(
    (scrollOffset: number, measurementsCache: VirtualItem[]) => {
      scrollStateStore.set(filterKey, { scrollOffset, measurementsCache });
    },
    [filterKey]
  );

  const getScrollState = useCallback((): ScrollState | undefined => {
    return scrollStateStore.get(filterKey);
  }, [filterKey]);

  return {
    saveScrollState,
    getScrollState,
  };
}
