"use client";

import { ConnectivityProvider } from "@/lib/offline/engine";

import { BaseProviders } from "./base-providers";

export interface AuthProvidersProps {
  children: React.ReactNode;
}

export function AuthProviders({ children }: AuthProvidersProps) {
  return (
    <BaseProviders>
      <ConnectivityProvider>{children}</ConnectivityProvider>
    </BaseProviders>
  );
}
