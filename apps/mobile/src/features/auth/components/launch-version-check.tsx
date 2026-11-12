import type { ServerAddressCheck } from "@/lib/network/server-address";
import { use, useEffect, useState } from "react";
import { useLaunchPhase } from "@/components/launch";
import { checkServerAddress } from "@/features/auth/utils/check-server-address";
import { updateServerHref } from "@/features/auth/utils/update-server-route";
import { resolveLaunchVersionCheck, resolveTooOldServerRoute } from "@/lib/boot/version-gate";
import { getServerAddress, ServerAddressContext } from "@/lib/network/server-address";
import { markServerTooOld, useTooOldServer } from "@/lib/network/too-old-server";
import { router, usePathname } from "expo-router";

// Module scope, once per launch: the session stack remounts on every re-key (sign-in, sign-out),
// so a remount picks up the check in flight and an answer is taken only once.
let launchCheck: Promise<ServerAddressCheck> | null = null;
let launchAnswered = false;

function launchCheckOf(address: string) {
  launchCheck ??= checkServerAddress(address);

  return launchCheck;
}

/**
 * Checks the saved Server Address once in the background, and shows Update your server on
 * whichever navigator is mounted while an address is held too old.
 */
export function LaunchVersionCheck({ enabled }: { enabled: boolean }) {
  const address = use(ServerAddressContext);
  const phase = useLaunchPhase();
  const pathname = usePathname();
  const tooOld = useTooOldServer();
  const [check, setCheck] = useState<ServerAddressCheck | null>(null);

  useEffect(() => {
    if (!enabled || !address || launchAnswered) return;

    let mounted = true;

    void launchCheckOf(address).then((answer) => {
      if (mounted) setCheck(answer);
    });

    return () => {
      mounted = false;
    };
  }, [enabled, address]);

  useEffect(() => {
    if (!check || launchAnswered) return;

    launchAnswered = true;

    const next = resolveLaunchVersionCheck(check, getServerAddress());

    if (next.screen === "update-server") {
      markServerTooOld({ address: next.address, version: next.version });
    }
  }, [check]);

  // Waits for the navigator; under the opaque splash it cuts in, revealed by the splash's fade.
  useEffect(() => {
    if (!enabled) return;

    const next = resolveTooOldServerRoute(tooOld, pathname === "/update-server", phase);

    if (next.screen === "update-server") {
      router.push(updateServerHref(next.address, next.version, next.animated));
    }
  }, [enabled, pathname, phase, tooOld]);

  return null;
}
