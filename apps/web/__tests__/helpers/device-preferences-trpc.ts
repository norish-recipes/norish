import { vi } from "vitest";

/**
 * The tRPC slice `useDevicePreference` uses. A test installs it with
 * `vi.mock("@norish/shared-react/trpc", () => import("../helpers/device-preferences-trpc"))`
 * (path relative to the test) and reads what was written from `deviceWrite`. Reads are not
 * served, so a re-read after a write leaves the cache as the test seeded and changed it.
 */
export const devicePreferencesQueryKey = [["user", "getDevicePreferences"], { type: "query" }];
export const deviceWrite = vi.fn();

const writeKey = [["user", "setDevicePreferences"]];

export function useTRPC() {
  return {
    user: {
      getDevicePreferences: {
        queryKey: () => devicePreferencesQueryKey,
        queryOptions: () => ({
          queryKey: devicePreferencesQueryKey,
          queryFn: () => Promise.reject(new Error("not served in this test")),
        }),
      },
      setDevicePreferences: {
        mutationKey: () => writeKey,
        mutationOptions: (options: object = {}) => ({
          ...options,
          mutationKey: writeKey,
          mutationFn: deviceWrite,
        }),
      },
    },
  };
}
