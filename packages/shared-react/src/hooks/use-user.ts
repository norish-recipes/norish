import { useSyncExternalStore } from "react";

import type { User } from "@norish/shared/contracts";
import { useSession } from "@norish/shared/lib/auth/client";

const noSubscription = () => () => {};

export function useUser() {
  const { data, isPending, error } = useSession();
  // The server renders without the session. One that lands before this
  // component hydrates (a slow device) waits for the render after, or the
  // HTML no longer matches and React throws the page away mid-tap.
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false
  );
  const session = hydrated ? data : null;

  const user: User | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image ?? null,
        version: 1,
      }
    : null;

  return {
    user,
    error: error ?? null,
    isLoading: isPending || !hydrated,
  };
}
