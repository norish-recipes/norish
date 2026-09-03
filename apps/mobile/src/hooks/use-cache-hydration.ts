import { useEffect, useState } from "react";
import { queryCacheRestorePromise } from "@/providers/trpc-provider";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("query-cache");

/**
 * Resolves once the persisted TanStack Query cache is hydrated from MMKV.
 *
 * The persisted cache is an optimisation, so a failed restore reports ready
 * anyway and the app starts with an empty cache. Blocking on it would leave the
 * boot gate waiting forever on something the app does not actually need.
 */
export function useCacheHydration(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    queryCacheRestorePromise
      .catch((error: unknown) => {
        log.warn({ error }, "Query cache hydration failed, starting with an empty cache");
      })
      .then(() => {
        if (mounted) setReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return ready;
}
