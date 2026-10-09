import { vi } from "vitest";

/**
 * The tRPC slice the Device Preferences provider uses. A test installs it with
 * `vi.mock("@/app/providers/trpc-provider", () => import("../helpers/device-preferences-trpc"))`
 * (path relative to the test) and reads what was written from `deviceWrite`.
 */
export const userQueryKey = [["user", "get"], { type: "query" }] as const;
export const deviceWrite = vi.fn();

const writeKey = [["user", "setDevicePreferences"]];

export function useTRPC() {
  return {
    user: {
      get: {
        queryKey: () => userQueryKey,
        queryOptions: () => ({ queryKey: userQueryKey, queryFn: async () => null }),
      },
      getAllergies: { queryKey: () => [["user", "getAllergies"], { type: "query" }] },
      setDevicePreferences: {
        mutationKey: () => writeKey,
        mutationOptions: () => ({ mutationKey: writeKey, mutationFn: deviceWrite }),
      },
    },
  };
}
