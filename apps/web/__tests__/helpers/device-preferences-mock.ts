import type {
  DeviceKind,
  DevicePreferences,
} from "@norish/shared/contracts/zod/device-preferences";
import { DEVICE_PREFERENCE_DEFAULTS } from "@norish/shared/contracts/zod/device-preferences";

type DevicePreferenceKey = keyof DevicePreferences;

/**
 * A stand-in for `@/context/device-preferences-context` over a test's own
 * state, for a test that renders without the provider. `read` runs on every
 * render, so the test changes the reader's choices through its own mocks;
 * `set` hears every write. Install it with
 * `vi.mock("@/context/device-preferences-context", async () =>
 *   (await import("<path>/helpers/device-preferences-mock")).mockDevicePreferences(() => ({ … })))`.
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
