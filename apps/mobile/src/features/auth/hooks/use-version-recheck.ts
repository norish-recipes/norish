import type { ForegroundContinue } from "@/lib/boot/boot-state";
import { useEffect, useEffectEvent } from "react";
import { AppState } from "react-native";
import { checkServerAddress } from "@/features/auth/utils/check-server-address";
import { resolveForegroundVersionCheck } from "@/lib/boot/boot-state";
import { useIsFocused } from "expo-router";

/**
 * While the screen is focused, re-checks `address` on each return to the foreground and calls
 * `onNewEnough` once it is; the re-check stops only once that continuation has succeeded.
 */
export function useVersionRecheck(
  address: string,
  signedIn: boolean,
  onNewEnough: (next: ForegroundContinue) => Promise<void> | void
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
      void checkServerAddress(address)
        .then(async (check) => {
          const next = resolveForegroundVersionCheck(check, signedIn);

          if (!live || next.screen === "stay") return;

          await continueOnce(next);
          live = false;
        })
        // A failed continuation leaves the re-check armed for the next return.
        .catch(() => {})
        .finally(() => {
          checking = false;
        });
    });

    return () => {
      live = false;
      subscription.remove();
    };
  }, [address, focused, signedIn]);
}
