"use client";

import { ConnectivityProvider } from "@/lib/offline/engine";

import type { BaseProvidersProps } from "./base-providers";
import { BaseProviders } from "./base-providers";

export function AuthProviders({ children, deviceKind }: BaseProvidersProps) {
  return (
    <BaseProviders deviceKind={deviceKind}>
      <ConnectivityProvider>{children}</ConnectivityProvider>
    </BaseProviders>
  );
}
