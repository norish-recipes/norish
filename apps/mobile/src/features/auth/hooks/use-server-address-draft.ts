import { useEffect, useState } from "react";
import { getServerAddress, loadServerAddress } from "@/lib/network/server-address";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("server-address");

export function useServerAddressDraft() {
  // The boot gate's read, so a pushed Server address shows the saved one from its first frame.
  const [address, setAddress] = useState(getServerAddress);
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

      if (savedAddress) setAddress(savedAddress);

      setIsHydrated(true);
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    address,
    setAddress,
    isHydrated,
  };
}
