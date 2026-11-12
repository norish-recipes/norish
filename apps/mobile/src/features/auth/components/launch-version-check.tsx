import type { ServerAddressCheck } from "@/lib/network/server-address";
import { use, useEffect, useState } from "react";
import { useLaunchFinished } from "@/components/launch";
import { checkServerAddress } from "@/features/auth/utils/check-server-address";
import { updateServerHref } from "@/features/auth/utils/update-server-route";
import { resolveLaunchVersionCheck } from "@/lib/boot/boot-state";
import { getServerAddress, ServerAddressContext } from "@/lib/network/server-address";
import { router } from "expo-router";

// Once per app launch: the session stack remounts on sign-in, sign-out and onboarding's first Connect.
let launchChecked = false;

/** Checks the saved Server Address once in the background; a too-old server gets Update your server. */
export function LaunchVersionCheck({ enabled }: { enabled: boolean }) {
  const address = use(ServerAddressContext);
  const finished = useLaunchFinished();
  const [check, setCheck] = useState<ServerAddressCheck | null>(null);

  useEffect(() => {
    // Waits for the navigator; a stack first mounted after the launch (onboarding's Connect) skips it.
    if (!enabled || !address || finished || launchChecked) return;

    launchChecked = true;
    void checkServerAddress(address).then(setCheck);
  }, [enabled, address, finished]);

  // Held until the splash is gone, so the first screen it fades to isn't replaced mid-fade.
  useEffect(() => {
    if (!check) return;

    const next = resolveLaunchVersionCheck(check, getServerAddress(), finished);

    if (next.screen === "update-server") router.push(updateServerHref(next.address, next.version));
  }, [check, finished]);

  return null;
}
