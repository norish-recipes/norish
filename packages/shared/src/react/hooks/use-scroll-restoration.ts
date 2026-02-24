import { useCallback } from "react";

export type ScrollMeasurement = {
  index: number;
  key: string | number;
  start: number;
  end: number;
  size: number;
  lane: number;
};

interface ScrollState {
  scrollOffset: number;
  measurementsCache: ScrollMeasurement[];
}

const scrollStateStore = new Map<string, ScrollState>();

export function useScrollRestoration(filterKey: string) {
  const saveScrollState = useCallback(
    (scrollOffset: number, measurementsCache: ScrollMeasurement[]) => {
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
