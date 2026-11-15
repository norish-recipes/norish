import { vi } from "vitest";

/**
 * The tRPC slice `useDevicePreference` uses, for `vi.mock("@norish/shared-react/trpc")`: writes
 * reach `deviceWrite`, and reads are refused, so a re-read leaves the cache as the test set it.
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
