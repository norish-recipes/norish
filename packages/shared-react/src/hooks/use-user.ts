import type { ReactNode } from "react";
import { createContext, createElement, use, useState } from "react";

import type { User } from "@norish/shared/contracts";
import { useSession } from "@norish/shared/lib/auth/client";

import { useHydrated } from "./use-hydrated";

/** The reader the server verified for this document, where a server rendered it (web). */
const ReaderSeedContext = createContext<User | null>(null);

/**
 * Hands `reader` to every useUser until the session first answers. One answer for all of them:
 * better-auth reports pending again on every refetch while signed out.
 */
export function ReaderSeedProvider({
  reader,
  children,
}: {
  reader: User | null;
  children: ReactNode;
}) {
  const { isPending } = useSession();
  const hydrated = useHydrated();
  const [answered, setAnswered] = useState(false);

  if (hydrated && !isPending && !answered) setAnswered(true);

  return createElement(ReaderSeedContext, { value: answered ? null : reader }, children);
}

export function useUser() {
  const seed = use(ReaderSeedContext);
  const { data, isPending, error } = useSession();
  // The server renders without the session. One that lands before this
  // component hydrates (a slow device) waits for the render after, or the
  // HTML no longer matches and React throws the page away mid-tap.
  const hydrated = useHydrated();
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
  const user = sessionUser ?? seed;

  return {
    user,
    error: error ?? null,
    isLoading: user === null && (isPending || !hydrated),
  };
}
