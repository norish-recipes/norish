import { useEffect } from "react";
import { AppState } from "react-native";
import { checkServerAddress } from "@/features/auth/utils/check-server-address";
import { resolveForegroundVersionCheck } from "@/lib/boot/boot-state";

/** Re-checks the server at `address` on each return to the foreground; calls `onNewEnough` once it is. */
export function useVersionRecheck(address: string, onNewEnough: (checkedAddress: string) => void) {
  useEffect(() => {
    let moved = false;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || moved) return;

      void checkServerAddress(address).then((check) => {
        const next = resolveForegroundVersionCheck(check);

        if (moved || next.screen === "stay") return;

        moved = true;
        onNewEnough(next.address);
      });
    });

    return () => subscription.remove();
  }, [address, onNewEnough]);
}
