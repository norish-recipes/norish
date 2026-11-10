import { vi } from "vitest";

import type { ReaderPermissions } from "@norish/shared-react/reader";
import type { User } from "@norish/shared/contracts";
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
export async function mockDevicePreferences(
  read: () => Partial<DevicePreferences> = () => ({}),
  {
    kind = () => "phone",
    set = () => {},
    reader = () => ({}),
  }: {
    kind?: () => DeviceKind;
    set?: (key: DevicePreferenceKey, next: unknown) => void;
    reader?: () => MockReader;
  } = {}
) {
  return {
    ...(await mockReader(reader)),
    useDeviceKind: kind,
    useDevicePreference: <K extends DevicePreferenceKey>(key: K) =>
      [
        { ...DEVICE_PREFERENCE_DEFAULTS, ...read() }[key],
        (next: DevicePreferences[K]) => set(key, next),
      ] as const,
  };
}

export type MockReader = {
  user?: Partial<User> | null;
  signOut?: () => void;
  /** Over the conservative defaults. */
  permissions?: Partial<ReaderPermissions>;
  /** Whether the Reader may edit and delete a recipe; `true` by default. */
  canEditRecipe?: (ownerId: string) => boolean;
  canDeleteRecipe?: (ownerId: string) => boolean;
  allergies?: string[];
};

/** The Reader's identity, permissions and allergies over the test's own state, read on every render. */
export async function mockReader(read: () => MockReader = () => ({})) {
  const { normalizePermissionsData } = await vi.importActual<
    typeof import("@norish/shared-react/reader")
  >("@norish/shared-react/reader");
  const permissions = (): ReaderPermissions => ({
    ...normalizePermissionsData(null),
    ...read().permissions,
  });

  return {
    useReader: () => ({
      user: read().user ?? null,
      isLoading: false,
      signOut: read().signOut ?? (() => {}),
    }),
    usePermissions: <T>(select: (p: ReaderPermissions) => T) => select(permissions()),
    useRecipePermissions: () => ({
      isLoading: false,
      canViewRecipe: () => true,
      canEditRecipe: read().canEditRecipe ?? (() => true),
      canDeleteRecipe: read().canDeleteRecipe ?? (() => true),
    }),
    useActiveAllergies: () => {
      const allergies = read().allergies ?? [];

      return { allergies, allergySet: new Set(allergies.map((a) => a.toLowerCase())) };
    },
  };
}
