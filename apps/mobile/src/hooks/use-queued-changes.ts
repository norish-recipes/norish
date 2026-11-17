import { useEffect, useState } from "react";
import { offlineEngine } from "@/lib/offline/engine";

import { useCacheOwner } from "@norish/shared-react/offline/react";

/** How many changes wait for the server (what a Sign-out confirms on), live and per account. */
export function useQueuedChanges() {
  const owner = useCacheOwner(offlineEngine.cache);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const load = () => void offlineEngine.unsyncedChanges().then(setCount);

    load();

    return offlineEngine.outbox.subscribe(load);
  }, [owner]);

  return count;
}
