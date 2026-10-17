import { createContext, use, useState, useSyncExternalStore } from "react";

import type { User } from "@norish/shared/contracts";
import { useSession } from "@norish/shared/lib/auth/client";

const noSubscription = () => () => {};

/** The reader the server verified for this document, where a server rendered it (web). */
export const ReaderSeedContext = createContext<User | null>(null);

export function useUser() {
  const seed = use(ReaderSeedContext);
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

  const sessionUser: User | null = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image ?? null,
        version: 1,
      }
    : null;
  // The server's reader is used on both sides of hydration and until the session first answers;
  // better-auth reports pending again on every refetch while signed out, so the answer is kept.
  const [answered, setAnswered] = useState(false);

  if (hydrated && !isPending && !answered) setAnswered(true);
  const user = sessionUser ?? (answered ? null : seed);

  return {
    user,
    error: error ?? null,
    isLoading: user === null && (isPending || !hydrated),
  };
}
