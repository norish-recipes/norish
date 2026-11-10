import { vi } from "vitest";

/** Every write the fake tRPC was sent, as (procedure path, input); a write never answers. */
export const sentWrites = vi.fn<(path: string, input: unknown) => void>();

const never = () => new Promise<never>(() => {});

/** One procedure: keys shaped like the real client's, a query that never answers, a recorded write. */
function procedure(path: string[]) {
  const key = (input: unknown, type: string) =>
    input === undefined ? [path, { type }] : [path, { input, type }];

  return {
    pathKey: () => [path],
    queryKey: (input?: unknown) => key(input, "query"),
    infiniteQueryKey: (input?: unknown) => key(input, "infinite"),
    queryOptions: (input?: unknown, options?: object) => ({
      ...options,
      queryKey: key(input, "query"),
      queryFn: never,
    }),
    infiniteQueryOptions: (input?: unknown, options?: object) => ({
      ...options,
      queryKey: key(input, "infinite"),
      queryFn: never,
    }),
    mutationKey: () => [path],
    mutationOptions: (options?: object) => ({
      ...options,
      mutationKey: [path],
      mutationFn: (input: unknown) => {
        sentWrites(path.join("."), input);

        return never();
      },
    }),
    subscriptionOptions: (input?: unknown, options?: object) => ({ ...options, enabled: false }),
  };
}

function node(path: string[]): unknown {
  return new Proxy(procedure(path), {
    get: (target, prop) =>
      typeof prop !== "string" || prop in target || prop === "then"
        ? Reflect.get(target, prop)
        : node([...path, prop]),
  });
}

/** A tRPC client with no server: reach any procedure by its path, as the real one does. */
const fakeTRPC = node([]);

/** One procedure of the fake client by its dotted path, for its keys. */
export const fakeProcedure = (path: string) => procedure(path.split("."));

/** `@norish/shared-react/trpc` over {@link fakeTRPC}, for a `vi.mock` factory. */
export async function mockTRPC() {
  const actual = await vi.importActual<typeof import("@norish/shared-react/trpc")>(
    "@norish/shared-react/trpc"
  );

  return { ...actual, useTRPC: () => fakeTRPC };
}
