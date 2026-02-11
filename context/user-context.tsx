"use client";

import type { User } from "@/types";

import { createContext, useContext, useState, ReactNode, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

import { useUser } from "@/hooks/use-user";
import { signOut as betterAuthSignOut } from "@/lib/auth/client";
import { useTRPC } from "@/app/providers/trpc-provider";

type UserContextType = {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User) => void;
  userMenuOpen: boolean;
  setUserMenuOpen: (open: boolean) => void;
  signOut: () => void;
};

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [optimisticUser, setOptimisticUser] = useState<User | null>(null);
  const { user: sessionUser, isLoading } = useUser();
  const trpc = useTRPC();

  const { data: freshUserData } = useQuery({
    ...trpc.user.get.queryOptions(),
    enabled: Boolean(sessionUser?.id),
    select: (data) => data.user,
  });

  const resolvedUser = freshUserData ?? sessionUser;

  // Use optimistic user if set, otherwise use session user
  const user = optimisticUser ?? resolvedUser;

  const signOut = useCallback(async () => {
    await betterAuthSignOut();
    window.location.href = "/login?logout=true";
  }, []);

  const setUser = useCallback((updatedUser: User) => {
    setOptimisticUser(updatedUser);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      setUser,
      userMenuOpen,
      setUserMenuOpen,
      signOut,
    }),
    [user, isLoading, setUser, userMenuOpen, signOut]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUserContext() {
  const context = useContext(UserContext);

  if (!context) {
    throw new Error("useUserContext must be used within UserProvider");
  }

  return context;
}
