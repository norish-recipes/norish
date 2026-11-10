"use client";

import { ConnectivityProvider } from "@/lib/offline/engine";

import type { BaseProvidersProps } from "./base-providers";
import { BaseProviders } from "./base-providers";

export function AuthProviders({ children, deviceKind, reader }: BaseProvidersProps) {
  return (
    <BaseProviders deviceKind={deviceKind} reader={reader}>
      <ConnectivityProvider>{children}</ConnectivityProvider>
    </BaseProviders>
  );
}
