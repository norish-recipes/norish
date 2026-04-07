import { useEffect, useRef } from "react";
import { useAuth } from "@/context/auth-context";
import { useNetworkStatus } from "@/context/network-context";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("session-revalidation");

/**
 * Listens for `appOnline: false => true` transitions and silently
 * re-validates the Better Auth session against the server.
 *
 * - If the session is authoritatively invalid (null/401/revoked), calls `signOut()`.
 * - If the check fails due to a transient network error, does **not** sign out;
 *   retries on the next `appOnline` restore.
 *
 * Must be mounted inside the auth-gated tree where `useAuth()` is available.
 */
export function useSessionRevalidation() {
  const { appOnline } = useNetworkStatus();
  const { authClient, signOut } = useAuth();
  const prevAppOnlineRef = useRef(appOnline);

  useEffect(() => {
    const wasOffline = !prevAppOnlineRef.current;

    prevAppOnlineRef.current = appOnline;

    if (!wasOffline || !appOnline || !authClient) {
      return;
    }

    let cancelled = false;

    async function revalidate() {
      try {
        log.info("App back online, validating session");

        const { data: session } = await authClient!.getSession();

        if (cancelled) {
          return;
        }

        if (!session?.user) {
          log.info("Session invalid or expired, signing out");
          await signOut();
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        log.warn({ error }, "Session validation failed transiently, will retry on next reconnect");
      }
    }

    void revalidate();

    return () => {
      cancelled = true;
    };
  }, [appOnline, authClient, signOut]);
}
