import type { PersistedUser } from "@/lib/auth/auth-storage";
import { useEffect, useState, useSyncExternalStore } from "react";
import { readPersistedSession } from "@/lib/auth/auth-storage";
import { useAuthClient } from "@/lib/auth/use-auth-client";

import type { PlatformSession } from "@norish/shared-react/platform";
import type { SessionUser } from "@norish/shared-react/reader";
import { useConnectivity } from "@norish/shared-react/offline/react";
import { sessionReader } from "@norish/shared-react/reader";

type AuthClient = ReturnType<typeof useAuthClient>;
type SessionState = {
  data: { user: SessionUser } | null;
  isPending: boolean;
  error: { status: number } | null;
};

const SIGNED_OUT: SessionState = { data: null, isPending: false, error: null };
const noSession = { get: () => SIGNED_OUT, listen: () => () => {} };

/**
 * The current client's session, or the persisted one while Offline, pending or on a non-401
 * error, so an Offline launch opens on its cached data. A 401 means signed out.
 */
export function useMobileSession(): PlatformSession {
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
    client: AuthClient;
    user: PersistedUser | null;
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

  const user = readsPersisted ? persistedUser : data?.user;
  const id = user?.id;
  const email = user?.email;
  const name = user?.name;
  const image = user?.image;

  return {
    user: id && email && name ? sessionReader({ id, email, name, image }) : null,
    isPending: readsPersisted ? persistedUser === undefined : isPending,
  };
}
