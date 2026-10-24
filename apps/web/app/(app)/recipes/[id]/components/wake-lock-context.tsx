"use client";

import React, { createContext, ReactNode, use } from "react";
import { useWakeLock } from "@/hooks/use-wake-lock";

interface WakeLockContextValue {
  isSupported: boolean;
  isActive: boolean;
  enable: () => Promise<void>;
  disable: () => void;
  toggle: () => Promise<void>;
}

const WakeLockContext = createContext<WakeLockContextValue | null>(null);

export function WakeLockProvider({ children }: { children: ReactNode }) {
  const wakeLock = useWakeLock();

  return <WakeLockContext value={wakeLock}>{children}</WakeLockContext>;
}

export function useWakeLockContext() {
  const context = use(WakeLockContext);

  if (!context) {
    throw new Error("useWakeLockContext must be used within WakeLockProvider");
  }

  return context;
}
