"use client";

import { getPersistedQueryClient, offlineEngine } from "@/lib/offline/engine";
import { Toast } from "@heroui/react";

import { TRPCProviderWrapper } from "./trpc-provider";

export interface BaseProvidersProps {
  children: React.ReactNode;
}

export function BaseProviders({ children }: BaseProvidersProps) {
  return (
    <>
      {/* The engine's QueryClient persists reads; its link queues unreachable mutations. */}
      <TRPCProviderWrapper
        getQueryClient={getPersistedQueryClient}
        mutationLink={offlineEngine.outboxLink}
      >
        {children}
      </TRPCProviderWrapper>
      <Toast.Provider maxVisibleToasts={1} placement="top" />
    </>
  );
}
