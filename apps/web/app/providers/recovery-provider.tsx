"use client";

import type { Recovery } from "@/lib/outbox/recovery";
import type { ReactNode } from "react";
import { createContext, use } from "react";

const RecoveryContext = createContext<Recovery | null>(null);

export function RecoveryProvider({
  recovery,
  children,
}: {
  recovery: Recovery;
  children: ReactNode;
}) {
  return <RecoveryContext value={recovery}>{children}</RecoveryContext>;
}

export function useRecovery(): Recovery {
  const recovery = use(RecoveryContext);

  if (!recovery) {
    throw new Error("useRecovery must be used within RecoveryProvider");
  }

  return recovery;
}
