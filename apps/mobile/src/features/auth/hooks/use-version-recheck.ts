import type { ForegroundContinue } from "@/lib/boot/boot-state";
import { useEffect, useEffectEvent } from "react";
import { AppState } from "react-native";
import { checkServerAddress } from "@/features/auth/utils/check-server-address";
import { resolveForegroundVersionCheck } from "@/lib/boot/boot-state";
import { useIsFocused } from "expo-router";

/** While the screen is focused, re-checks `address` on each return to the foreground; calls `onNewEnough` once it is. */
export function useVersionRecheck(
  address: string,
  signedIn: boolean,
  onNewEnough: (next: ForegroundContinue) => void
) {
  const focused = useIsFocused();
  const continueOnce = useEffectEvent(onNewEnough);

  useEffect(() => {
    if (!focused) return;

    // `live` drops a result landing after blur or unmount; `checking` keeps one check at a time.
    let live = true;
    let checking = false;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || checking || !live) return;

      checking = true;
      void checkServerAddress(address).then((check) => {
        checking = false;

        const next = resolveForegroundVersionCheck(check, signedIn);

        if (!live || next.screen === "stay") return;

        live = false;
        continueOnce(next);
      });
    });

    return () => {
      live = false;
      subscription.remove();
    };
  }, [address, focused, signedIn]);
}
