"use client";

import { getPersistedQueryClient, offlineEngine } from "@/lib/offline/engine";
import { Toast } from "@heroui/react";

import type { PlatformSession } from "@norish/shared-react/platform";
import type { DeviceKind } from "@norish/shared/contracts/zod/device-preferences";

import { WebPlatformProvider } from "./platform-provider";
import { TRPCProviderWrapper } from "./trpc-provider";

interface BaseProvidersProps {
  children: React.ReactNode;
  /** The request's Device Kind; absent on an Offline start-up. */
  deviceKind?: DeviceKind;
  /** The signed-in shell's session; signed out elsewhere. */
  session?: PlatformSession;
}

export function BaseProviders({ children, deviceKind, session }: BaseProvidersProps) {
  return (
    <WebPlatformProvider deviceKind={deviceKind} session={session}>
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
