import { useCallback, useRef } from "react";

type VirtualAnchorItem = {
  index: number;
  start: number;
};

type PendingPrependAnchor = {
  key: string;
  offsetWithinItem: number;
};

type UsePrependAnchorRestoreArgs = {
  keys: string[];
};

type CaptureAnchorArgs = {
  index: number;
  itemStart: number;
  scrollOffset: number;
};

export function usePrependAnchorRestore({ keys }: UsePrependAnchorRestoreArgs) {
  const pendingPrependAnchorRef = useRef<PendingPrependAnchor | null>(null);

  const captureAnchor = useCallback(
    ({ index, itemStart, scrollOffset }: CaptureAnchorArgs) => {
      const key = keys[index];

      if (!key) return;

      pendingPrependAnchorRef.current = {
        key,
        offsetWithinItem: scrollOffset - itemStart,
      };
    },
    [keys]
  );

  const shouldAdjustScrollForSizeChange = useCallback(
    (itemStart: number, scrollOffset: number, scrollMargin: number) => {
      if (pendingPrependAnchorRef.current) return false;

      return itemStart < scrollOffset + scrollMargin;
    },
    []
  );

  const restoreAnchor = useCallback(
    (getVirtualItems: () => VirtualAnchorItem[], scrollToOffset: (offset: number) => void) => {
      const anchor = pendingPrependAnchorRef.current;

      if (!anchor) return;

      const targetIndex = keys.indexOf(anchor.key);

      if (targetIndex < 0) {
        pendingPrependAnchorRef.current = null;

        return;
      }

      const targetItem = getVirtualItems().find((item) => item.index === targetIndex);

      if (targetItem) {
        scrollToOffset(targetItem.start + anchor.offsetWithinItem);
      }

      pendingPrependAnchorRef.current = null;
    },
    [keys]
  );

  return {
    captureAnchor,
    restoreAnchor,
    shouldAdjustScrollForSizeChange,
  };
}
