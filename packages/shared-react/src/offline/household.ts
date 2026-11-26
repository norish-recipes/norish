import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import type { AppRouter } from "@norish/trpc/client";

let key: ReturnType<typeof buildKey> | null = null;

// Names tRPC's path key; it never sends a request or touches a client.
const buildKey = () =>
  createTRPCOptionsProxy<AppRouter>({
    client: createTRPCClient<AppRouter>({ links: [] }),
    queryClient: () => new QueryClient(),
  }).households.get.queryKey();

/** The Reader's household read, the one place the client learns which household it is in. */
export const householdQueryKey = () => (key ??= buildKey());

/** The household id a `households.get` answer names. */
export function householdIdOf(data: unknown): string | null {
  const id = (data as { household?: { id?: unknown } | null } | undefined)?.household?.id;

  return typeof id === "string" ? id : null;
}

/** The household the client holds the Reader to be in now, or null before it is read. */
export const currentHousehold = (queryClient: QueryClient): string | null =>
  householdIdOf(queryClient.getQueryData(householdQueryKey()));
