import { useEffect, useState } from "react";
import { loadBackendBaseUrl, subscribeBackendBaseUrlChange } from "@/lib/network/backend-base-url";

/**
 * Loads (and live-updates) the backend base URL from MMKV storage.
 * Returns `undefined` while loading, `null` if not configured, or the URL string.
 */
export function useBackendBaseUrl(): string | null | undefined {
  const [url, setUrl] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const value = await loadBackendBaseUrl();
      if (mounted) setUrl(value);
    }

    const unsubscribe = subscribeBackendBaseUrlChange(() => void load());
    void load();

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return url;
}
