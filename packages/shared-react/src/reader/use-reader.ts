"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { User } from "@norish/shared/contracts";

import type { PlatformSession } from "../platform";
import type { SessionUser } from "./session";
import { useHydrated, usePlatform } from "../platform";
import { useTRPC } from "../trpc";
import { useSessionReader } from "./session";

type ReaderIdentity = {
  /** The signed-in Reader, or null signed out or while the session is unknown. */
  user: User | null;
  isLoading: boolean;
};

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

  const user = useSessionReader(hydrated ? session.user : null);

  return { user: user ?? (answered ? null : seed), isPending: session.isPending || !hydrated };
}

/** The signed-in Reader: the session's, overlaid by their profile once `user.get` has it. */
export function useReader(): ReaderIdentity {
  const trpc = useTRPC();
  const { session } = usePlatform();
  const sessionUser = session.user;

  const { data: profile } = useQuery({
    ...trpc.user.get.queryOptions(),
    enabled: Boolean(sessionUser?.id),
    select: (data) => data.user,
  });
  const user = profile ?? sessionUser;

  return { user, isLoading: user === null && session.isPending };
}
