"use client";

import { useState } from "react";

// Library cards are virtualised and remount on every scroll; a closed panel per card would still be
// a vaul root with its state and effects each time. Mount it on first open, then keep it to animate out.
export function useMountedOnceOpened(open: boolean) {
  const [mounted, setMounted] = useState(open);

  if (open && !mounted) {
    setMounted(true);
  }

  return mounted;
}
