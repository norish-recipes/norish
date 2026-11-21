import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { SIGN_IN_DEADLINE_MS } from "@/features/auth/utils/auth-failure";
import { resolveSigningIn } from "@/features/auth/utils/signing-in";

/** Signing in's outcome; the deadline counts foreground time, so a return from the background restarts the wait. */
export function useSigningIn(signedIn: boolean) {
  const [waited, setWaited] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => clearTimeout(timer);
    const start = () => {
      stop();
      timer = setTimeout(() => setWaited(SIGN_IN_DEADLINE_MS), SIGN_IN_DEADLINE_MS);
    };

    if (AppState.currentState === "active") start();
    const sub = AppState.addEventListener("change", (state) =>
      state === "active" ? start() : stop()
    );

    return () => {
      sub.remove();
      stop();
    };
  }, []);

  return resolveSigningIn(signedIn, waited);
}
