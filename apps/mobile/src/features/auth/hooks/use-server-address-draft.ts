import { useEffect, useState } from "react";
import { loadServerAddress } from "@/lib/network/server-address";
import { useRouter } from "expo-router";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("server-address");

export function useServerAddressDraft() {
  const router = useRouter();
  const [address, setAddress] = useState("");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      let savedAddress: string | null;

      try {
        savedAddress = await loadServerAddress();
      } catch (error) {
        // Show the empty form rather than spinning forever. Nothing is
        // discarded: without a successful read there is no stored URL to
        // preserve, and saving a new one surfaces the same failure with a
        // message attached.
        log.error({ error }, "Could not read the stored Server Address, showing an empty form");

        if (isMounted) setIsHydrated(true);

        return;
      }

      if (!isMounted) {
        return;
      }

      if (savedAddress) {
        if (router.canGoBack()) {
          // Navigated here intentionally (e.g. "Change server" from login).
          // Show the form pre-filled with the current URL instead of redirecting.
          setAddress(savedAddress);
          setIsHydrated(true);

          return;
        }

        // Cold-start: URL already configured - skip straight to login.
        // Stack.Protected guard handles final redirect once authenticated.
        router.replace("/login");

        return;
      }

      setIsHydrated(true);
    })();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return {
    address,
    setAddress,
    isHydrated,
  };
}
