import { vi } from "vitest";

import type { User } from "@norish/shared/contracts";
import type { DeviceKind } from "@norish/shared/contracts/zod/device-preferences";

import type { PlatformAdapter } from "./platform";

/** A test's platform: spies for toasts, navigation, errors and sign-out, a storage that holds nothing. */
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
    signOut: vi.fn(),
  };
}
