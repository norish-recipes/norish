"use client";

import type { Recovery } from "@/lib/outbox/recovery";
import type { ReactNode } from "react";
import { createContext, useContext } from "react";

const RecoveryContext = createContext<Recovery | null>(null);

export function RecoveryProvider({
  recovery,
  children,
}: {
  recovery: Recovery;
  children: ReactNode;
}) {
  return <RecoveryContext.Provider value={recovery}>{children}</RecoveryContext.Provider>;
}

export function useRecovery(): Recovery {
  const recovery = useContext(RecoveryContext);

  if (!recovery) {
    throw new Error("useRecovery must be used within RecoveryProvider");
  }

  return recovery;
}
