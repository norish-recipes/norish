"use client";

import { Toast } from "@heroui/react";

import { TRPCProviderWrapper } from "./trpc-provider";

export interface BaseProvidersProps {
  children: React.ReactNode;
}

export function BaseProviders({ children }: BaseProvidersProps) {
  return (
    <>
      <TRPCProviderWrapper>{children}</TRPCProviderWrapper>
      <Toast.Provider maxVisibleToasts={1} placement="top" />
    </>
  );
}
