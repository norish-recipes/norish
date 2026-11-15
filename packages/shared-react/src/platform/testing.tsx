import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi } from "vitest";

import type { User } from "@norish/shared/contracts";
import type { DeviceKind } from "@norish/shared/contracts/zod/device-preferences";

import type { PlatformAdapter } from "./platform";
import { PlatformProvider } from "./platform";

/** A test's platform: spies for toasts, navigation, errors and sign-out's steps, a storage that holds nothing. */
export function fakePlatformAdapter(
  deviceKind: DeviceKind = "phone",
  reader: User | null = null
): PlatformAdapter {
  return {
    toast: { show: vi.fn(), translate: (id) => id },
    navigation: { toHome: vi.fn(), toRecipe: vi.fn() },
    showError: vi.fn(),
    storage: { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() },
    deviceKind,
    session: { user: reader, isPending: false },
    endSession: vi.fn(async () => {}),
    leave: vi.fn(),
    offlineEngine: { clearForSignOut: vi.fn(async () => {}) },
  };
}

/** A QueryClient that never retries and keeps what it holds for the whole test. */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

/** The providers the shared hooks read: the query client and the app's platform adapter. */
export function createTestWrapper(
  queryClient: QueryClient,
  adapter: PlatformAdapter = fakePlatformAdapter()
) {
  return function TestWrapper({ children }: { children: ReactNode }) {
    "use memo";

    return (
      <PlatformProvider adapter={adapter}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </PlatformProvider>
    );
  };
}
