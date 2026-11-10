"use client";

import { useState } from "react";

/**
 * Whether an overlay should be in the tree at all.
 *
 * Library cards are virtualized, so one scrolls out and back in constantly —
 * and a panel mounted before it is ever opened subscribes to its queries on
 * every one of those mounts, refetching them each time. Nothing renders until
 * the reader actually opens it; after that it stays, so closing still
 * animates.
 */
export function useMountedOnceOpened(open: boolean) {
  const [mounted, setMounted] = useState(open);

  if (open && !mounted) {
    setMounted(true);
  }

  return mounted;
}
