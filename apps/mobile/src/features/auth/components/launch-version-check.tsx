import { use, useEffect, useRef } from "react";
import { checkServerAddress } from "@/features/auth/utils/check-server-address";
import { updateServerHref } from "@/features/auth/utils/update-server-route";
import { resolveLaunchVersionCheck } from "@/lib/boot/boot-state";
import { ServerAddressContext } from "@/lib/network/server-address";
import { useRouter } from "expo-router";

/** Checks the saved Server Address once in the background; a too-old server gets Update your server. */
export function LaunchVersionCheck({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const address = use(ServerAddressContext);
  const startedRef = useRef(false);

  useEffect(() => {
    // Waits for the navigator, and runs once however the session settles.
    if (!enabled || !address || startedRef.current) return;

    startedRef.current = true;
    void checkServerAddress(address).then((check) => {
      const next = resolveLaunchVersionCheck(check);

      if (next.screen === "update-server")
        router.push(updateServerHref(next.address, next.version));
    });
  }, [enabled, address, router]);

  return null;
}
