import type { BackendBaseUrlState } from "@/lib/network/backend-base-url";
import { useCallback, useEffect, useState } from "react";
import { loadBackendBaseUrl, subscribeBackendBaseUrlChange } from "@/lib/network/backend-base-url";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("backend-base-url");

export type BackendBaseUrlResult = BackendBaseUrlState & {
  /** Re-reads storage. Lets the user recover without force-quitting the app. */
  retry: () => void;
};

/**
 * Loads (and live-updates) the backend base URL from secure storage.
 */
export function useBackendBaseUrl(): BackendBaseUrlResult {
  const [state, setState] = useState<BackendBaseUrlState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((current) => current + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const url = await loadBackendBaseUrl();

        if (mounted) setState({ status: "ready", url });
      } catch (error) {
        log.error({ error }, "Could not read the stored backend URL");

        if (mounted) setState({ status: "error", error });
      }
    }

    const unsubscribe = subscribeBackendBaseUrlChange(() => void load());
    void load();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [attempt]);

  return { ...state, retry };
}
