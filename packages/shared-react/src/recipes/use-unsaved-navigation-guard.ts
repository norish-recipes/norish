"use client";

import { useRef } from "react";

interface UseUnsavedNavigationGuardOptions {
  hasUnsavedChanges: boolean;
  /** Asks the reader whether to discard; calls `leave` only when they agree. */
  ask: (leave: () => void) => void;
}

/**
 * Leaving a form with unsaved changes asks first. A save calls `allowNavigation` so its own
 * navigation passes, and `disallowNavigation` when it fails.
 */
export function useUnsavedNavigationGuard({
  hasUnsavedChanges,
  ask,
}: UseUnsavedNavigationGuardOptions) {
  const allowedRef = useRef(false);

  const allowNavigation = () => {
    allowedRef.current = true;
  };
  const disallowNavigation = () => {
    allowedRef.current = false;
  };
  const mustAsk = () => hasUnsavedChanges && !allowedRef.current;
  const requestLeave = (leave: () => void) => {
    if (!mustAsk()) {
      leave();

      return;
    }

    ask(() => {
      allowedRef.current = true;
      leave();
    });
  };

  return { allowNavigation, disallowNavigation, mustAsk, requestLeave };
}
