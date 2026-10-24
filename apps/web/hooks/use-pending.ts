"use client";

import { useState } from "react";

/**
 * A flag that is up while an action runs: `whilePending(action)` raises it,
 * runs the action and lowers it again however the action ends.
 */
export function usePending(): [boolean, <T>(action: () => Promise<T>) => Promise<T>] {
  const [pending, setPending] = useState(false);

  const whilePending = <T>(action: () => Promise<T>): Promise<T> => {
    setPending(true);

    return action().finally(() => setPending(false));
  };

  return [pending, whilePending];
}
