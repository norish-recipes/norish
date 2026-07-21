"use client";

import type { ThemeProviderProps } from "next-themes";

import { BaseProviders } from "./base-providers";
import { ConnectivityProvider } from "./connectivity-provider";

export interface AuthProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

export function AuthProviders({ children, themeProps }: AuthProvidersProps) {
  return (
    <BaseProviders themeProps={themeProps}>
      <ConnectivityProvider>{children}</ConnectivityProvider>
    </BaseProviders>
  );
}
