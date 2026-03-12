import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { getAuthClient } from '@/lib/auth-client';

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
  const authClient = useMemo(() => getAuthClient(backendBaseUrl), [backendBaseUrl]);
  const { data: session, isPending } = authClient.useSession();
  const [justLoggedOut, setJustLoggedOut] = useState(false);

  const isAuthenticated = !!session?.user;
  const isLoading = isPending;

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setJustLoggedOut(true);
  }, [authClient]);

  const consumeLogoutFlag = useCallback(() => {
    setJustLoggedOut(false);
  }, []);

  const user = session?.user
    ? {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      }
    : null;

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
    [authClient, backendBaseUrl, consumeLogoutFlag, isAuthenticated, isLoading, justLoggedOut, signOut, user],
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
    [],
  );

  if (!backendBaseUrl) {
    return <AuthContext.Provider value={noUrlValue}>{children}</AuthContext.Provider>;
  }

  return <AuthProviderInner backendBaseUrl={backendBaseUrl}>{children}</AuthProviderInner>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
