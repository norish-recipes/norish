import { useEffect, useState } from "react";
import { queryCacheRestorePromise } from "@/providers/trpc-provider";

/** Resolves once the persisted TanStack Query cache is hydrated from MMKV. */
export function useCacheHydration(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    queryCacheRestorePromise.then(() => setReady(true));
  }, []);

  return ready;
}
