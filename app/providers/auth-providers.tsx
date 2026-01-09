"use client";

import type { ThemeProviderProps } from "next-themes";

import { BaseProviders } from "./base-providers";

import { ConnectionStatusOverlay } from "@/components/shared/connection-status-overlay";

export interface AuthProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

export function AuthProviders({ children, themeProps }: AuthProvidersProps) {
  return (
    <BaseProviders themeProps={themeProps}>
      <ConnectionStatusOverlay />
      {children}
    </BaseProviders>
  );
}
