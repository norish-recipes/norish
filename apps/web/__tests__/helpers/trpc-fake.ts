import { skipToken } from "@tanstack/react-query";
import { vi } from "vitest";

import { trackedEvent } from "../hooks/realtime-test-utils";

/** Every write the fake tRPC was sent, as (procedure path, input). */
export const sentWrites = vi.fn<(path: string, input: unknown) => void>();

/** Every read the fake tRPC was sent, as (procedure path, input). */
export const sentReads = vi.fn<(path: string, input: unknown) => void>();

/** How a read answers, by dotted path; a read with none never answers. */
export const readAnswers = new Map<string, (input: unknown) => Promise<unknown>>();

/** How a write answers, by dotted path; a write with none never answers. */
export const writeAnswers = new Map<string, (input: unknown) => Promise<unknown>>();

const never = () => new Promise<never>(() => {});

/** Each subscription mounted now, by procedure path: its `onData`. */
const subscribers = new Map<string, Set<(data: unknown) => void>>();

/** The procedures subscribed to now, by dotted path. */
export const liveSubscriptions = () =>
  [...subscribers].filter(([, mounted]) => mounted.size > 0).map(([path]) => path);

/** Hands every mounted subscription to `path` one event, as the server sends it. */
export function deliver(path: string, payload: unknown) {
  for (const onData of subscribers.get(path) ?? []) onData(trackedEvent(payload));
}

/** One procedure: keys shaped like the real client's, a recorded read and write. */
function procedure(path: string[]) {
  const key = (input: unknown, type: string) =>
    input === undefined ? [path, { type }] : [path, { input, type }];
  const read = (input: unknown) => () => {
    sentReads(path.join("."), input);

    return readAnswers.get(path.join("."))?.(input) ?? never();
  };

  return {
    pathKey: () => [path],
    pathFilter: () => ({ queryKey: [path] }),
    queryKey: (input?: unknown) => key(input, "query"),
    infiniteQueryKey: (input?: unknown) => key(input, "infinite"),
    queryOptions: (input?: unknown, options?: object) => ({
      ...options,
      queryKey: key(input, "query"),
      queryFn: read(input),
    }),
    infiniteQueryOptions: (input?: unknown, options?: object) => ({
      ...options,
      queryKey: key(input, "infinite"),
      queryFn: read(input),
    }),
    mutationKey: () => [path],
    mutationOptions: (options?: object) => ({
      ...options,
      mutationKey: [path],
      mutationFn: (input: unknown) => {
        sentWrites(path.join("."), input);

        return writeAnswers.get(path.join("."))?.(input) ?? never();
      },
    }),
    subscriptionOptions: (input: unknown, options: { enabled?: boolean } = {}) => ({
      ...options,
      // As @trpc/tanstack-react-query reads it: a present but undefined `enabled` disables.
      enabled: "enabled" in options ? !!options.enabled : input !== skipToken,
      queryKey: key(input, "subscription"),
      subscribe: ({ onData }: { onData: (data: unknown) => void }) => {
        const mounted = subscribers.get(path.join(".")) ?? new Set();

        mounted.add(onData);
        subscribers.set(path.join("."), mounted);

        return { unsubscribe: () => mounted.delete(onData) };
      },
    }),
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
