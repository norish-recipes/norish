import type { ReactNode } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  fadeOutSignedIn,
  getAuthTransportSnapshot,
  publishSignedIn,
  subscribeAuthTransport,
} from "@/lib/auth/auth-session-sync";
import { endSession } from "@/lib/auth/end-session";
import { useAuthClient } from "@/lib/auth/use-auth-client";
import { useMobileSession } from "@/lib/auth/use-mobile-session";
import { MobileIntlProvider } from "@/lib/i18n/mobile-i18n-context";
import { MobilePlatformProvider } from "@/lib/platform/platform-provider";

import { expireSession, useSessionExpiry } from "@norish/shared-react/reader";

const ENDING = { user: null, isPending: true };

/** Hands the session to the platform adapter, with `endSession` on the current client. */
export function AuthProviders({ children }: { children: ReactNode }) {
  const authClient = useAuthClient();
  const { ended, ...liveSession } = useMobileSession();
  const { hasActiveSession } = useSyncExternalStore(
    subscribeAuthTransport,
    getAuthTransportSnapshot
  );
  // Pending from endSession until leave's re-key remounts this: the client empties its store early.
  const [ending, setEnding] = useState(false);
  // Signed in, then the server answered no session with no sequence ending it: a Session Expiry.
  const expired = hasActiveSession && !ending && ended;
  const session = ending || expired ? ENDING : liveSession;
  const signedIn = session.user !== null;

  // Publishing re-keys the tRPC provider, which remounts this one; signed out is leave's to publish.
  useEffect(() => {
    if (signedIn && !session.isPending) publishSignedIn();
  }, [session.isPending, signedIn]);

  useEffect(() => {
    if (expired) void expireSession();
  }, [expired]);

  // The boot gate mounts this only with a server, so there is always a client.
  if (!authClient) return null;

  return (
    <MobileIntlProvider signedIn={signedIn}>
      <MobilePlatformProvider
        endSession={async (scope) => {
          // Faded out while still signed in, so the ending's unmount happens out of sight.
          await fadeOutSignedIn();
          setEnding(true);
          await endSession(authClient, scope).catch((error: unknown) => {
            void fadeOutSignedIn(false);
            throw error;
          });
        }}
        session={session}
      >
        {hasActiveSession && <SessionExpiry />}
        {children}
      </MobilePlatformProvider>
    </MobileIntlProvider>
  );
}

/** Mounted from sign-in until leave, so it outlives the signed-in shell a session ending unmounts. */
function SessionExpiry() {
  useSessionExpiry();

  return null;
}
