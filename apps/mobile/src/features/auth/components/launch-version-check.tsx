import type { ServerAddressCheck } from "@/lib/network/server-address";
import { use, useEffect, useState } from "react";
import { useLaunchPhase } from "@/components/launch";
import { checkServerAddress } from "@/features/auth/utils/check-server-address";
import { updateServerHref } from "@/features/auth/utils/update-server-route";
import { resolveLaunchVersionCheck } from "@/lib/boot/boot-state";
import { getServerAddress, ServerAddressContext } from "@/lib/network/server-address";
import { router } from "expo-router";

// Module scope, once per launch: the session stack remounts on every re-key (sign-in, sign-out),
// so a remount picks up the check in flight and an answer acted on is never acted on again.
let launchCheck: Promise<ServerAddressCheck> | null = null;
let launchAnswered = false;

function launchCheckOf(address: string) {
  launchCheck ??= checkServerAddress(address);

  return launchCheck;
}

/** Checks the saved Server Address once in the background; a too-old server gets Update your server. */
export function LaunchVersionCheck({ enabled }: { enabled: boolean }) {
  const address = use(ServerAddressContext);
  const phase = useLaunchPhase();
  const [check, setCheck] = useState<ServerAddressCheck | null>(null);

  useEffect(() => {
    // Waits for the navigator, so the answer has a stack to open on.
    if (!enabled || !address || launchAnswered) return;

    let mounted = true;

    void launchCheckOf(address).then((answer) => {
      if (mounted) setCheck(answer);
    });

    return () => {
      mounted = false;
    };
  }, [enabled, address]);

  // Under the opaque splash it cuts in, revealed by the splash's fade; once the splash is leaving
  // it waits, so the screen being revealed isn't replaced mid-fade.
  useEffect(() => {
    if (!check || launchAnswered) return;

    const next = resolveLaunchVersionCheck(check, getServerAddress(), phase);

    if (next.screen === "wait") return;

    launchAnswered = true;
    if (next.screen === "update-server") {
      router.push(updateServerHref(next.address, next.version, next.animated));
    }
  }, [check, phase]);

  return null;
}
