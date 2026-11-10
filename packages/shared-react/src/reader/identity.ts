"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { User } from "@norish/shared/contracts";

import type { PlatformSession, SignOut } from "../platform";
import { useHydrated, usePlatform } from "../platform";
import { useTRPC } from "../trpc";

/** The user an auth client's session carries. */
export type SessionUser = { id: string; email: string; name: string; image?: string | null };

export type ReaderIdentity = {
  /** The signed-in Reader, or null signed out or while the session is unknown. */
  user: User | null;
  isLoading: boolean;
  signOut: SignOut;
};

/** The Reader a session names, until `user.get` brings their profile. */
export function sessionReader(user: SessionUser): User {
  return { id: user.id, email: user.email, name: user.name, image: user.image ?? null, version: 1 };
}

/**
 * A server-rendered app's session: `seed`, the reader the server verified, answers until the
 * session first does, and the session is read only once hydrated, so both renders match.
 */
export function useSeededSession(
  session: { user: SessionUser | null; isPending: boolean },
  seed: User | null
): PlatformSession {
  const hydrated = useHydrated();
  const [answered, setAnswered] = useState(false);

  // better-auth reports pending again on every refetch while signed out: the first answer stands.
  if (hydrated && !session.isPending && !answered) setAnswered(true);

  // Kept by field, so a refetched session of the same reader keeps the same user.
  const live = hydrated ? session.user : null;
  const id = live?.id;
  const email = live?.email;
  const name = live?.name;
  const image = live?.image;
  const user = useMemo(
    () =>
      id && email !== undefined && name !== undefined
        ? sessionReader({ id, email, name, image })
        : null,
    [id, email, name, image]
  );

  return { user: user ?? (answered ? null : seed), isPending: session.isPending || !hydrated };
}

/** The signed-in Reader: the session's, overlaid by their profile once `user.get` has it. */
export function useReader(): ReaderIdentity {
  const trpc = useTRPC();
  const { session, signOut } = usePlatform();
  const sessionUser = session.user;

  const { data: profile } = useQuery({
    ...trpc.user.get.queryOptions(),
    enabled: Boolean(sessionUser?.id),
    select: (data) => data.user,
  });
  const user = profile ?? sessionUser;

  return { user, isLoading: user === null && session.isPending, signOut };
}
