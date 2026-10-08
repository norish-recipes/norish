import type { DevicePreferencesSeed } from "@/lib/request-profile";
import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { render } from "@testing-library/react";

import { DevicePreferencesProvider } from "@/context/device-preferences-context";

import type { DevicePreferences } from "@norish/shared/contracts/zod/device-preferences";
import { DEVICE_PREFERENCE_DEFAULTS } from "@norish/shared/contracts/zod/device-preferences";

import { createTestQueryClient, createTestWrapper } from "../hooks/user/test-utils";

export { deviceWrite, userQueryKey } from "./device-preferences-trpc";

/** Render under the provider, seeded as a server pass would. */
export function renderWithDevicePreferences(
  ui: ReactNode,
  {
    values = {},
    seed = {},
    queryClient = createTestQueryClient(),
  }: {
    values?: Partial<DevicePreferences>;
    seed?: Partial<DevicePreferencesSeed> | null;
    queryClient?: QueryClient;
  } = {}
) {
  const Wrapper = createTestWrapper(queryClient);
  const providerSeed: DevicePreferencesSeed | undefined =
    seed === null
      ? undefined
      : {
          kind: "phone",
          values: { ...DEVICE_PREFERENCE_DEFAULTS, ...values },
          signedIn: true,
          readAt: Date.now(),
          ...seed,
        };

  return render(
    <Wrapper>
      <DevicePreferencesProvider seed={providerSeed}>{ui}</DevicePreferencesProvider>
    </Wrapper>
  );
}
