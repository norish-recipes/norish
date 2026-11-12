import { use, useEffect } from "react";
import { useLaunchFinished } from "@/components/launch";
import { checkServerAddress } from "@/features/auth/utils/check-server-address";
import { updateServerHref } from "@/features/auth/utils/update-server-route";
import { resolveLaunchVersionCheck } from "@/lib/boot/boot-state";
import { getServerAddress, ServerAddressContext } from "@/lib/network/server-address";
import { useRouter } from "expo-router";

// Once per app launch: the session stack remounts on sign-in, sign-out and onboarding's first Connect.
let launchChecked = false;

/** Checks the saved Server Address once in the background; a too-old server gets Update your server. */
export function LaunchVersionCheck({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const address = use(ServerAddressContext);
  const finished = useLaunchFinished();

  useEffect(() => {
    // Waits for the navigator; a stack first mounted after the launch (onboarding's Connect) skips it.
    if (!enabled || !address || finished || launchChecked) return;

    launchChecked = true;
    void checkServerAddress(address).then((check) => {
      const next = resolveLaunchVersionCheck(check, getServerAddress());

      if (next.screen === "update-server")
        router.push(updateServerHref(next.address, next.version));
    });
  }, [enabled, address, finished, router]);

  return null;
}
