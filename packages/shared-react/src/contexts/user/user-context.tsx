import { createContext, use, useMemo } from "react";

import type { User } from "@norish/shared/contracts";

export type UserContextValue = {
  user: User | null;
  isLoading: boolean;
  /**
   * Complete an explicit sign-out. `discardQueue` is set only after the user
   * confirmed discarding unsynced offline changes (ADR-0009, web).
   */
  signOut: (options?: { discardQueue?: boolean }) => void | Promise<void>;
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
  // Settled once here rather than called with `?.()`: the compiler only
  // compiles a component whose hooks it sees called unconditionally.
  const useFreshUserQueryOrNone = useFreshUserQuery ?? (() => undefined);

  function UserProvider({ children }: { children: React.ReactNode }) {
    "use memo";

    const { user: sessionUser, isLoading } = useSessionUser();
    const signOut = useSignOut();

    const freshUser = useFreshUserQueryOrNone(sessionUser?.id);
    const user = freshUser?.user ?? sessionUser;

    const value = useMemo<UserContextValue>(
      () => ({
        user,
        isLoading,
        signOut,
      }),
      [user, isLoading, signOut]
    );

    return <SharedUserContext value={value}>{children}</SharedUserContext>;
  }

  function useUserContext(): UserContextValue {
    "use memo";

    const context = use(SharedUserContext);

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
