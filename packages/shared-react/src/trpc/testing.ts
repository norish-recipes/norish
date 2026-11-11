import { act, waitFor } from "@testing-library/react";

type Deferred = { resolve: (value: unknown) => void; reject: (error: unknown) => void };

/** Each write the fake was sent, by procedure path; each waits until the test settles it. */
export const trpcCalls: Record<string, { input: unknown; deferred: Deferred }[]> = {};

/** Reads that answer only when `answerRead` is called, by procedure path. */
const pendingReads: Record<string, ((data: unknown) => void)[]> = {};

export function answerRead(path: string, data: unknown) {
  for (const answer of pendingReads[path]?.splice(0) ?? []) answer(data);
}

export function resetTRPCFake() {
  for (const name of Object.keys(trpcCalls)) delete trpcCalls[name];
  for (const name of Object.keys(pendingReads)) delete pendingReads[name];
}

function procedure(path: string[]) {
  const name = path.join(".");
  const queryKey = (input?: unknown) =>
    input === undefined ? [path, { type: "query" }] : [path, { input, type: "query" }];

  return {
    queryKey,
    queryOptions: (input?: unknown, options?: object) => ({
      ...options,
      queryKey: queryKey(input),
      queryFn: () => new Promise((resolve) => (pendingReads[name] ??= []).push(resolve)),
    }),
    mutationOptions: (options: object = {}) => ({
      ...options,
      mutationKey: [path],
      mutationFn: (input: unknown) =>
        new Promise((resolve, reject) => {
          (trpcCalls[name] ??= []).push({ input, deferred: { resolve, reject } });
        }),
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

/** `../trpc` for a `vi.mock`: every procedure by path, reads and writes the test settles. */
export function mockTRPC() {
  const trpc = node([]);

  return { useTRPC: () => trpc };
}

/** The key the real client gives a procedure's query with no input. */
export const keyOf = (path: string) => [path.split("."), { type: "query" }];

/** Waits until write `index` to `path` was sent, and hands it back. */
export async function sentCall(path: string, index = 0) {
  return waitFor(() => {
    const call = trpcCalls[path]?.[index];

    if (!call) throw new Error(`no call ${index} to ${path}`);

    return call;
  });
}

/** Answers write `index` to `path` once it is sent. */
export async function answerCall(path: string, value: unknown, index = 0) {
  const call = await sentCall(path, index);

  await act(async () => call.deferred.resolve(value));
}

/** Fails write `index` to `path` once it is sent. */
export async function failCall(path: string, index = 0) {
  const call = await sentCall(path, index);

  await act(async () => call.deferred.reject(new Error("offline")));
}
