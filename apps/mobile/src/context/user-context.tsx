import React, { useCallback } from "react";
import { useAuth } from "@/context/auth-context";
import { useTRPC } from "@/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

import type { UserContextValue } from "@norish/shared-react/contexts";
import type { User } from "@norish/shared/contracts";
import { createUserContext } from "@norish/shared-react/contexts";

/**
 * Mobile UserContext — mirrors web's user-context.tsx using the same
 * shared createUserContext factory.
 *
 * - useSessionUser: reads from mobile's auth-context (better-auth expo client)
 * - useSignOut: delegates to auth-context's signOut
 * - useFreshUserQuery: fetches trpc.user.get for the full User (with preferences)
 */
const shared = createUserContext({
  useSessionUser: () => {
    const { user, isLoading } = useAuth();

    const sessionUser: User | null = user
      ? {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image ?? null,
          version: 1,
        }
      : null;

    return { user: sessionUser, isLoading };
  },
  useSignOut: () => {
    const { signOut } = useAuth();

    return useCallback(() => {
      void signOut();
    }, [signOut]);
  },
  useFreshUserQuery: (userId) => {
    const trpc = useTRPC();

    const { data } = useQuery({
      ...trpc.user.get.queryOptions(),
      enabled: Boolean(userId),
      select: (data) => data.user as User,
      staleTime: 60_000,
    });

    return { user: data };
  },
});

export const UserProvider = shared.UserProvider;
export const useUserContext = shared.useUserContext;
export type { UserContextValue };
