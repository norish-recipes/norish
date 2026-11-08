import type {
  DeviceKind,
  DevicePreferences,
} from "@norish/shared/contracts/zod/device-preferences";
import { DEVICE_PREFERENCE_DEFAULTS } from "@norish/shared/contracts/zod/device-preferences";

type DevicePreferenceKey = keyof DevicePreferences;

/**
 * `@norish/shared-react/reader` over the test's own state, for a `vi.mock` without a query cache:
 * `read` runs on every render and `set` hears every write.
 */
export function mockDevicePreferences(
  read: () => Partial<DevicePreferences> = () => ({}),
  {
    kind = () => "phone",
    set = () => {},
  }: {
    kind?: () => DeviceKind;
    set?: (key: DevicePreferenceKey, next: unknown) => void;
  } = {}
) {
  return {
    useDeviceKind: kind,
    useDevicePreference: <K extends DevicePreferenceKey>(key: K) =>
      [
        { ...DEVICE_PREFERENCE_DEFAULTS, ...read() }[key],
        (next: DevicePreferences[K]) => set(key, next),
      ] as const,
  };
}
