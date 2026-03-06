import { createContext, useContext, useMemo } from "react";

import type { User } from "@norish/shared/contracts";

export type UserContextValue = {
  user: User | null;
  isLoading: boolean;
  signOut: () => void;
};

type CreateUserContextOptions = {
  /** Hook returning session user and loading state */
  useSessionUser: () => { user: User | null; isLoading: boolean };
  /** Hook returning a sign-out function */
  useSignOut: () => () => void;
  /** Optional hook to get fresh user data from API (overlays session user) */
  useFreshUserQuery?: (userId: string | undefined) => { user: User | undefined };
};

export function createUserContext({
  useSessionUser,
  useSignOut,
  useFreshUserQuery,
}: CreateUserContextOptions) {
  const SharedUserContext = createContext<UserContextValue | null>(null);

  function UserProvider({ children }: { children: React.ReactNode }) {
    const { user: sessionUser, isLoading } = useSessionUser();
    const signOut = useSignOut();

    const freshUser = useFreshUserQuery?.(sessionUser?.id);
    const user = freshUser?.user ?? sessionUser;

    const value = useMemo<UserContextValue>(
      () => ({
        user,
        isLoading,
        signOut,
      }),
      [user, isLoading, signOut]
    );

    return <SharedUserContext.Provider value={value}>{children}</SharedUserContext.Provider>;
  }

  function useUserContext(): UserContextValue {
    const context = useContext(SharedUserContext);

    if (!context) {
      throw new Error("useUserContext must be used within UserProvider");
    }

    return context;
  }

  return {
    UserProvider,
    useUserContext,
  };
}
