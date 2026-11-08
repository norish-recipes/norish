import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { render } from "@testing-library/react";
import { vi } from "vitest";

import type { PlatformAdapter } from "@norish/shared-react/platform";
import type {
  DeviceKind,
  DevicePreferences,
} from "@norish/shared/contracts/zod/device-preferences";
import { PlatformProvider } from "@norish/shared-react/platform";
import { DevicePreferencesForVisit } from "@norish/shared-react/reader";
import {
  DEVICE_PREFERENCE_DEFAULTS,
  deviceBlocks,
} from "@norish/shared/contracts/zod/device-preferences";

import { createTestQueryClient, createTestWrapper } from "../hooks/user/test-utils";
import { devicePreferencesQueryKey } from "./device-preferences-trpc";

export { deviceWrite, devicePreferencesQueryKey } from "./device-preferences-trpc";

function testAdapter(deviceKind: DeviceKind): PlatformAdapter {
  return {
    toast: { show: vi.fn(), translate: (id) => id },
    navigation: { toHome: vi.fn(), toRecipe: vi.fn() },
    showError: vi.fn(),
    storage: { getItem: () => null, setItem: vi.fn(), removeItem: vi.fn() },
    deviceKind,
  };
}

/**
 * Render with the reader's Device Preferences seeded as a server pass would, `values` on this
 * kind's block; `forVisit` renders a shared recipe's.
 */
export function renderWithDevicePreferences(
  ui: ReactNode,
  {
    values = {},
    kind = "phone",
    forVisit = false,
    queryClient = createTestQueryClient(),
  }: {
    values?: Partial<DevicePreferences>;
    kind?: DeviceKind;
    forVisit?: boolean;
    queryClient?: QueryClient;
  } = {}
) {
  const Wrapper = createTestWrapper(queryClient);

  queryClient.setQueryData(
    devicePreferencesQueryKey,
    deviceBlocks({ [kind]: { ...DEVICE_PREFERENCE_DEFAULTS, ...values } })
  );

  return render(
    <Wrapper>
      <PlatformProvider adapter={testAdapter(kind)}>
        {forVisit ? <DevicePreferencesForVisit>{ui}</DevicePreferencesForVisit> : ui}
      </PlatformProvider>
    </Wrapper>
  );
}
