"use client";

import type { ArchiveImportQueryResult } from "@/hooks/archive/use-archive-import-query";

import { createContext, useContext, ReactNode } from "react";

import { useArchiveImportQuery, useArchiveImportSubscription } from "@/hooks/archive";

const ArchiveImportContext = createContext<ArchiveImportQueryResult | null>(null);

export function ArchiveImportProvider({ children }: { children: ReactNode }) {
  // Activate archive import subscriptions (progress and completion events)
  useArchiveImportSubscription();
  const importState = useArchiveImportQuery();

  return (
    <ArchiveImportContext.Provider value={importState}>{children}</ArchiveImportContext.Provider>
  );
}

export function useArchiveImportContext() {
  const ctx = useContext(ArchiveImportContext);

  if (!ctx) {
    throw new Error("useArchiveImportContext must be used within ArchiveImportProvider");
  }

  return ctx;
}
