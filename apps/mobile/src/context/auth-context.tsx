import type { PersistedUser } from "@/lib/auth-storage";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useNetworkStatus } from "@/context/network-context";
import { clearAllQueryCaches } from "@/hooks/use-cache-lifecycle";
import { getAuthClient, resetAuthClientStorage } from "@/lib/auth-client";
import { registerSessionInvalidationHandler, setHasActiveSession } from "@/lib/auth-session-sync";
import { readPersistedSession } from "@/lib/auth-storage";
import { closeMobileTrpcConnections } from "@/providers/trpc-provider";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("auth");

type AuthContextValue = {
  backendBaseUrl: string | null;
  authClient: ReturnType<typeof getAuthClient> | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  justLoggedOut: boolean;
  user: { id: string; email: string; name: string; image?: string | null } | null;
  signOut: () => Promise<void>;
  consumeLogoutFlag: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function AuthProviderInner({
  backendBaseUrl,
  children,
}: {
  backendBaseUrl: string;
  children: React.ReactNode;
}) {
  const [authClientVersion, setAuthClientVersion] = useState(0);
  const authClient = useMemo(
    () => getAuthClient(backendBaseUrl),
    [authClientVersion, backendBaseUrl]
  );
  const { data: session, isPending, error: sessionError } = authClient.useSession();
  const [justLoggedOut, setJustLoggedOut] = useState(false);
  const [authOverride, setAuthOverride] = useState<"none" | "signed-out">("none");

  // Network awareness
  const { backendReachable, deviceOnline, runtimeState } = useNetworkStatus();

  // Persisted session state (loaded once when backend is unreachable)
  const [persistedUser, setPersistedUser] = useState<PersistedUser | null>(null);
  const [persistedSessionStatus, setPersistedSessionStatus] = useState<
    "idle" | "loading" | "loaded"
  >("idle");

  const liveUser = useMemo(
    () =>
      session?.user
        ? {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            image: session.user.image,
          }
        : null,
    [session?.user?.id, session?.user?.email, session?.user?.name, session?.user?.image]
  );
  const usePersistedAuth =
    runtimeState === "ready" &&
    !liveUser &&
    (!deviceOnline || (!!sessionError && !backendReachable));

  useEffect(() => {
    if (!usePersistedAuth || persistedSessionStatus !== "idle") {
      return;
    }

    setPersistedSessionStatus("loading");

    void readPersistedSession().then((user) => {
      setPersistedUser(user);
      setPersistedSessionStatus("loaded");
    });
  }, [persistedSessionStatus, usePersistedAuth]);

  const { isAuthenticated, isLoading, user } = useMemo(() => {
    if (authOverride === "signed-out" || runtimeState === "initializing") {
      return {
        isAuthenticated: false,
        isLoading: runtimeState === "initializing",
        user: null,
      };
    }

    if (usePersistedAuth) {
      return {
        isAuthenticated: !!persistedUser,
        isLoading: persistedSessionStatus === "loading",
        user: persistedUser,
      };
    }

    return {
      isAuthenticated: !!session?.user,
      isLoading: isPending,
      user: liveUser,
    };
  }, [
    authOverride,
    isPending,
    liveUser,
    persistedSessionStatus,
    persistedUser,
    runtimeState,
    session?.user,
    usePersistedAuth,
  ]);

  const signOut = useCallback(async () => {
    setAuthOverride("signed-out");
    setHasActiveSession(false);
    await closeMobileTrpcConnections();
    clearAllQueryCaches();

    try {
      await authClient.signOut();
    } catch (error) {
      log.warn({ error }, "Remote sign out failed, resetting local auth client state");
    } finally {
      try {
        await resetAuthClientStorage();
      } catch (storageError) {
        log.warn({ error: storageError }, "Failed to reset auth client storage during sign out");
      }

      setAuthClientVersion((current) => current + 1);
      setPersistedUser(null);
      setPersistedSessionStatus("idle");
      setJustLoggedOut(true);
      setHasActiveSession(false);
    }
  }, [authClient]);

  useEffect(() => {
    setHasActiveSession(isAuthenticated);
  }, [isAuthenticated]);

  useEffect(() => {
    return registerSessionInvalidationHandler(async (reason) => {
      if (!isAuthenticated) {
        return;
      }

      log.info(`Session invalidated by ${reason}, signing out`);
      await signOut();
    });
  }, [isAuthenticated, signOut]);

  const consumeLogoutFlag = useCallback(() => {
    setJustLoggedOut(false);
    setAuthOverride("none");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      backendBaseUrl,
      authClient,
      isAuthenticated,
      isLoading,
      justLoggedOut,
      user,
      signOut,
      consumeLogoutFlag,
    }),
    [
      authClient,
      backendBaseUrl,
      consumeLogoutFlag,
      isAuthenticated,
      isLoading,
      justLoggedOut,
      signOut,
      user,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({
  backendBaseUrl,
  children,
}: {
  backendBaseUrl: string | null;
  children: React.ReactNode;
}) {
  const noUrlValue = useMemo<AuthContextValue>(
    () => ({
      backendBaseUrl: null,
      authClient: null,
      isAuthenticated: false,
      isLoading: false,
      justLoggedOut: false,
      user: null,
      signOut: async () => {},
      consumeLogoutFlag: () => {},
    }),
    []
  );

  if (!backendBaseUrl) {
    return <AuthContext.Provider value={noUrlValue}>{children}</AuthContext.Provider>;
  }

  return <AuthProviderInner backendBaseUrl={backendBaseUrl}>{children}</AuthProviderInner>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
