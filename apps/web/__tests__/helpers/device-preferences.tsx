import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { render } from "@testing-library/react";

import type {
  DeviceKind,
  DevicePreferences,
} from "@norish/shared/contracts/zod/device-preferences";
import { PlatformProvider } from "@norish/shared-react/platform";
import { fakePlatformAdapter } from "@norish/shared-react/platform/testing";
import { DevicePreferencesForVisit } from "@norish/shared-react/reader";
import {
  DEVICE_PREFERENCE_DEFAULTS,
  deviceBlocks,
} from "@norish/shared/contracts/zod/device-preferences";

import { createTestQueryClient, createTestWrapper } from "../hooks/user/test-utils";
import { devicePreferencesQueryKey } from "./device-preferences-trpc";

export { deviceWrite, devicePreferencesQueryKey } from "./device-preferences-trpc";

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
      <PlatformProvider adapter={fakePlatformAdapter(kind)}>
        {forVisit ? <DevicePreferencesForVisit>{ui}</DevicePreferencesForVisit> : ui}
      </PlatformProvider>
    </Wrapper>
  );
}
