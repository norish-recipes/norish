import type { AuthClient } from "@/lib/auth/auth-client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { readPersistedSession } from "@/lib/auth/auth-storage";
import { useAuthClient } from "@/lib/auth/use-auth-client";

import type { PlatformSession } from "@norish/shared-react/platform";
import type { SessionUser } from "@norish/shared-react/reader";
import { useConnectivity } from "@norish/shared-react/offline/react";
import { useSessionReader } from "@norish/shared-react/reader";

type SessionState = {
  data: { user: SessionUser } | null;
  isPending: boolean;
  error: { status: number } | null;
};

const SIGNED_OUT: SessionState = { data: null, isPending: false, error: null };
const noSession = { get: () => SIGNED_OUT, listen: () => () => {} };

/** The client's session, or the persisted one while Offline, pending or on a non-401 error, so an
 * Offline launch opens on cached data; `ended` is a 401 or a settled read with no session. */
export function useMobileSession(): PlatformSession & { ended: boolean } {
  const authClient = useAuthClient();
  // Read directly: better-auth's useStore shows the previous client's last value for a render.
  const sessionAtom = authClient?.$store.atoms.session ?? noSession;
  const { data, isPending, error } = useSyncExternalStore<SessionState>(
    (onChange) => sessionAtom.listen(onChange),
    () => sessionAtom.get()
  );
  const { isOffline } = useConnectivity();
  // Keyed by client: a reset wipes the stored session, so a new client reads it again.
  const [persisted, setPersisted] = useState<{
    client: AuthClient | null;
    user: SessionUser | null;
  }>();

  const readsPersisted = !data && error?.status !== 401 && (isPending || !!error || isOffline);
  const persistedUser = persisted?.client === authClient ? persisted.user : undefined;

  useEffect(() => {
    if (!readsPersisted || persistedUser !== undefined) return;

    let current = true;

    void readPersistedSession().then((user) => {
      if (current) setPersisted({ client: authClient, user });
    });

    return () => {
      current = false;
    };
  }, [authClient, persistedUser, readsPersisted]);

  const user = useSessionReader(readsPersisted ? persistedUser : data?.user);

  return {
    user,
    isPending: readsPersisted ? persistedUser === undefined : isPending,
    ended: !data && !isPending && (!error || error.status === 401),
  };
}
