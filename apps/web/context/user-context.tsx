"use client";

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

import type { User } from "@norish/shared/contracts";
import { useUser } from "@norish/shared/react/hooks";
import { signOut as betterAuthSignOut } from "@norish/shared/lib/auth/client";

type UserContextType = {
  user: User | null;
  isLoading: boolean;
  userMenuOpen: boolean;
  setUserMenuOpen: (open: boolean) => void;
  signOut: () => void;
};

const UserContext = createContext<UserContextType | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const { user: sessionUser, isLoading } = useUser();
  const trpc = useTRPC();

  const { data: freshUserData } = useQuery({
    ...trpc.user.get.queryOptions(),
    enabled: Boolean(sessionUser?.id),
    select: (data) => data.user,
  });

  const user = freshUserData ?? sessionUser;

  const signOut = useCallback(async () => {
    await betterAuthSignOut();
    window.location.href = "/login?logout=true";
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      userMenuOpen,
      setUserMenuOpen,
      signOut,
    }),
    [user, isLoading, userMenuOpen, signOut]
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
