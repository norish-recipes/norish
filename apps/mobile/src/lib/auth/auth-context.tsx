import type { PersistedUser } from "@/lib/auth/auth-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { getAuthClient, subscribeAuthClientReset } from "@/lib/auth/auth-client";
import { setHasActiveSession } from "@/lib/auth/auth-session-sync";
import { readPersistedSession } from "@/lib/auth/auth-storage";
import { endSession as endSessionOn } from "@/lib/auth/end-session";
import { useStore } from "better-auth/react";

import type { LeaveReason } from "@norish/shared-react/platform";
import { useConnectivity } from "@norish/shared-react/offline/react";

type AuthContextValue = {
  backendBaseUrl: string | null;
  authClient: ReturnType<typeof getAuthClient> | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  justLoggedOut: boolean;
  user: { id: string; email: string; name: string; image?: string | null } | null;
  /** The platform adapter's `endSession`: always succeeds on a phone. */
  endSession: (reason: LeaveReason) => Promise<void>;
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
  // Reread after each reset, so this and the offline engine hold one client, even when
  // signing out remounts this provider before the reset.
  const authClient = useSyncExternalStore(subscribeAuthClientReset, () =>
    getAuthClient(backendBaseUrl)
  );
  // What authClient.useSession() runs, called directly so it is one hook whichever client is current.
  const {
    data: session,
    isPending,
    error: sessionError,
  }: ReturnType<typeof authClient.useSession> = useStore(authClient.$store.atoms.session);
  const [justLoggedOut, setJustLoggedOut] = useState(false);
  const [authOverride, setAuthOverride] = useState<"none" | "signed-out">("none");

  const { isOffline } = useConnectivity();

  // The persisted session, read while the live one is unknown or unreachable
  const [persistedUser, setPersistedUser] = useState<PersistedUser | null>(null);
  const [persistedSessionStatus, setPersistedSessionStatus] = useState<
    "idle" | "loading" | "loaded"
  >("idle");

  // Kept by field, so a refetched session of the same user keeps the same liveUser.
  const userId = session?.user.id;
  const userEmail = session?.user.email;
  const userName = session?.user.name;
  const userImage = session?.user.image;
  const liveUser = useMemo(
    () =>
      userId !== undefined && userEmail !== undefined && userName !== undefined
        ? { id: userId, email: userEmail, name: userName, image: userImage }
        : null,
    [userId, userEmail, userName, userImage]
  );
  // Until the server answers, the persisted session stands in, so an Offline launch opens on
  // its cached data instead of the sign-in screen. A 401 is an answer: the session is gone.
  const sessionRejected = sessionError?.status === 401;
  const shouldUsePersistedAuth =
    !liveUser && !sessionRejected && (isPending || !!sessionError || isOffline);

  useEffect(() => {
    if (!shouldUsePersistedAuth || persistedSessionStatus !== "idle") {
      return;
    }

    setPersistedSessionStatus("loading");

    void readPersistedSession().then((user) => {
      setPersistedUser(user);
      setPersistedSessionStatus("loaded");
    });
  }, [persistedSessionStatus, shouldUsePersistedAuth]);

  const { isAuthenticated, isLoading, user } = useMemo(() => {
    if (authOverride === "signed-out") {
      return { isAuthenticated: false, isLoading: false, user: null };
    }

    if (shouldUsePersistedAuth) {
      return {
        isAuthenticated: !!persistedUser,
        isLoading: persistedSessionStatus !== "loaded",
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
    session?.user,
    shouldUsePersistedAuth,
  ]);

  // The session store is emptied first, so a remount before these sets reads signed out.
  const endSession = async (reason: LeaveReason) => {
    await endSessionOn(authClient, reason);
    setAuthOverride("signed-out");
    setPersistedUser(null);
    setPersistedSessionStatus("idle");
    setJustLoggedOut(true);
  };

  // Publishing re-keys the tRPC provider, which remounts this one; a remount that published its
  // first "loading, signed out" render would flip the key back and loop.
  useEffect(() => {
    if (!isLoading) setHasActiveSession(isAuthenticated);
  }, [isAuthenticated, isLoading]);

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
      endSession,
      consumeLogoutFlag,
    }),
    [
      authClient,
      backendBaseUrl,
      consumeLogoutFlag,
      isAuthenticated,
      isLoading,
      justLoggedOut,
      endSession,
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
      endSession: async () => {},
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
