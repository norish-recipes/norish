import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { setHasActiveSession } from "@/lib/auth/auth-session-sync";
import { endSession } from "@/lib/auth/end-session";
import { useAuthClient } from "@/lib/auth/use-auth-client";
import { useMobileSession } from "@/lib/auth/use-mobile-session";
import { MobileIntlProvider } from "@/lib/i18n/mobile-i18n-context";
import { MobilePlatformProvider } from "@/lib/platform/platform-provider";

const ENDING = { user: null, isPending: true };

/** Hands the session to the platform adapter, with `endSession` on the current client. */
export function AuthProviders({ children }: { children: ReactNode }) {
  const authClient = useAuthClient();
  const liveSession = useMobileSession();
  // Pending from endSession until leave's re-key remounts this: the client empties its store early.
  const [ending, setEnding] = useState(false);
  const session = ending ? ENDING : liveSession;
  const signedIn = session.user !== null;

  // Publishing re-keys the tRPC provider, which remounts this one; publishing its first
  // pending render would flip the key back and loop.
  useEffect(() => {
    if (!session.isPending) setHasActiveSession(signedIn);
  }, [session.isPending, signedIn]);

  return (
    <MobileIntlProvider signedIn={signedIn}>
      <MobilePlatformProvider
        endSession={(reason) => {
          setEnding(true);

          return endSession(authClient, reason).catch((error: unknown) => {
            setEnding(false);
            throw error;
          });
        }}
        session={session}
      >
        {children}
      </MobilePlatformProvider>
    </MobileIntlProvider>
  );
}
