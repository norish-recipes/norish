"use client";

import { BaseProviders } from "./base-providers";
import { ConnectivityProvider } from "./connectivity-provider";

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
