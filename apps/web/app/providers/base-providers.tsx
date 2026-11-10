"use client";

import { getPersistedQueryClient, offlineEngine } from "@/lib/offline/engine";
import { Toast } from "@heroui/react";

import type { User } from "@norish/shared/contracts";
import type { DeviceKind } from "@norish/shared/contracts/zod/device-preferences";

import { WebPlatformProvider } from "./platform-provider";
import { TRPCProviderWrapper } from "./trpc-provider";

export interface BaseProvidersProps {
  children: React.ReactNode;
  /** The request's Device Kind; absent on an Offline start-up. */
  deviceKind?: DeviceKind;
  /** Who the server verified for this document, drawn until the session answers. */
  reader?: User;
}

export function BaseProviders({ children, deviceKind, reader }: BaseProvidersProps) {
  return (
    <WebPlatformProvider deviceKind={deviceKind} reader={reader}>
      {/* The engine's QueryClient persists reads; its link queues unreachable mutations. */}
      <TRPCProviderWrapper
        getQueryClient={getPersistedQueryClient}
        mutationLink={offlineEngine.outboxLink}
      >
        {children}
      </TRPCProviderWrapper>
      <Toast.Provider maxVisibleToasts={1} placement="top" />
    </WebPlatformProvider>
  );
}
