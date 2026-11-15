import type { ServerAddressState } from "@/lib/network/server-address";
import { useEffect, useState } from "react";
import { loadServerAddress, subscribeServerAddressChange } from "@/lib/network/server-address";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("server-address");

type ServerAddressResult = ServerAddressState & {
  /** Re-reads storage. Lets the user recover without force-quitting the app. */
  retry: () => void;
};

/**
 * Loads (and live-updates) the Server Address from secure storage.
 */
export function useServerAddress(): ServerAddressResult {
  const [state, setState] = useState<ServerAddressState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  // The error screen stays up until the re-read answers; "loading" would blank it, splash gone.
  const retry = () => setAttempt((current) => current + 1);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const url = await loadServerAddress();

        if (mounted) setState({ status: "ready", url });
      } catch (error) {
        log.error({ error }, "Could not read the stored Server Address");

        if (mounted) setState({ status: "error", error });
      }
    }

    const unsubscribe = subscribeServerAddressChange(() => void load());

    void load();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [attempt]);

  return { ...state, retry };
}
