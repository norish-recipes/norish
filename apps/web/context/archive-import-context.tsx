"use client";

import type { ArchiveImportQueryResult } from "@/hooks/archive";
import { createContext, ReactNode, use } from "react";
import { useArchiveImportQuery, useArchiveImportSubscription } from "@/hooks/archive";

const ArchiveImportContext = createContext<ArchiveImportQueryResult | null>(null);

export function ArchiveImportProvider({ children }: { children: ReactNode }) {
  // Activate archive import subscriptions (progress and completion events)
  useArchiveImportSubscription();
  const importState = useArchiveImportQuery();

  return <ArchiveImportContext value={importState}>{children}</ArchiveImportContext>;
}

export function useArchiveImportContext() {
  const ctx = use(ArchiveImportContext);

  if (!ctx) {
    throw new Error("useArchiveImportContext must be used within ArchiveImportProvider");
  }

  return ctx;
}
