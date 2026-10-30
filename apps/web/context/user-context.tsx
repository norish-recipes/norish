"use client";

import { createContext, ReactNode, use, useCallback } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { clearOfflineStateForSignOut } from "@/lib/offline/sign-out";
import { useQuery } from "@tanstack/react-query";

import type { UserContextValue } from "@norish/shared-react/contexts";
import type { User } from "@norish/shared/contracts";
import { createUserContext } from "@norish/shared-react/contexts";
import { useUser } from "@norish/shared-react/hooks";
import { ReaderSeedProvider } from "@norish/shared-react/hooks/use-user";
import { signOut as betterAuthSignOut } from "@norish/shared/lib/auth/client";
import { addBasePath } from "@norish/shared/lib/base-path";

// Create the shared base context
const shared = createUserContext({
  useSessionUser: () => {
    const { user, isLoading } = useUser();

    return { user, isLoading };
  },
  useSignOut: () => {
    return useCallback(async (options?: { discardQueue?: boolean }) => {
      // The auth sign-out completes first: if it fails (e.g. Offline),
      // nothing local is discarded — the session, queue, and caches stay
      // exactly as they were, equivalent to Cancel (ADR-0009).
      try {
        const result = await betterAuthSignOut();

        if (result && typeof result === "object" && "error" in result && result.error) {
          return;
        }
      } catch {
        return;
      }

      await clearOfflineStateForSignOut({
        discardQueue: options?.discardQueue ?? false,
      });
      window.location.href = addBasePath("/login?logout=true");
    }, []);
  },
  useFreshUserQuery: (userId) => {
    const trpc = useTRPC();

    const { data } = useQuery({
      ...trpc.user.get.queryOptions(),
      enabled: Boolean(userId),
      select: (data) => data.user,
    });

    return { user: data };
  },
});

type WebUserContextType = UserContextValue;

const WebUserContext = createContext<WebUserContextType | null>(null);

/** `reader`: who the server verified for this document, until the session answers. */
export function UserProvider({ children, reader }: { children: ReactNode; reader?: User }) {
  return (
    <ReaderSeedProvider reader={reader ?? null}>
      <shared.UserProvider>
        <WebUserProviderInner>{children}</WebUserProviderInner>
      </shared.UserProvider>
    </ReaderSeedProvider>
  );
}

function WebUserProviderInner({ children }: { children: ReactNode }) {
  const sharedContext = shared.useUserContext();

  return <WebUserContext value={sharedContext}>{children}</WebUserContext>;
}

export function useUserContext(): WebUserContextType {
  const context = use(WebUserContext);

  if (!context) {
    throw new Error("useUserContext must be used within UserProvider");
  }

  return context;
}
