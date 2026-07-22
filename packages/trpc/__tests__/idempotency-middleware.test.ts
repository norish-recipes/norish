// @vitest-environment node
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { describe, expect, it } from "vitest";

import type { IdempotencyConfig, IdempotencyRedis } from "../src/idempotency-middleware";
import { cachedMiddlewareResult, runWithIdempotency } from "../src/idempotency-middleware";

/**
 * Minimal in-memory Redis honouring the `SET ... NX` semantics the middleware
 * relies on. TTL flags are accepted and ignored (tests never expire).
 */
function createFakeRedis(): IdempotencyRedis & { store: Map<string, string> } {
  const store = new Map<string, string>();

  return {
    store,
    async set(key: string, value: string, ...args: unknown[]) {
      const nx = args.includes("NX");

      if (nx && store.has(key)) {
        return null;
      }

      store.set(key, value);

      return "OK";
    },
    async get(key: string) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    async del(...keys: string[]) {
      let removed = 0;

      for (const key of keys) {
        if (store.delete(key)) removed++;
      }

      return removed;
    },
  };
}

type TestResult = { ok: boolean; data: unknown };

function makeConfig(redis: IdempotencyRedis): IdempotencyConfig {
  return { getRedis: async () => redis, ttlSeconds: 100, pollIntervalMs: 1, pollMaxAttempts: 50 };
}

const RESULT_ADAPTERS = {
  isOk: (result: TestResult) => result.ok,
  getData: (result: TestResult) => result.data,
  toCachedResult: (data: unknown): TestResult => ({ ok: true, data }),
};

describe("runWithIdempotency", () => {
  it("executes the handler once and returns the stored response for a duplicate operationId (the replay case)", async () => {
    const redis = createFakeRedis();
    let calls = 0;
    const params = {
      isMutation: true,
      operationId: "op-1",
      userId: "user-1",
      next: async (): Promise<TestResult> => {
        calls++;

        return { ok: true, data: { n: calls } };
      },
      ...RESULT_ADAPTERS,
    };

    const first = await runWithIdempotency(params, makeConfig(redis));
    const second = await runWithIdempotency(params, makeConfig(redis));

    expect(calls).toBe(1);
    expect(first.data).toEqual({ n: 1 });
    expect(second.data).toEqual({ n: 1 });
  });

  it("executes independently for different operationIds", async () => {
    const redis = createFakeRedis();
    let calls = 0;
    const next = async (): Promise<TestResult> => {
      calls++;

      return { ok: true, data: { n: calls } };
    };

    await runWithIdempotency(
      { isMutation: true, operationId: "op-A", userId: "user-1", next, ...RESULT_ADAPTERS },
      makeConfig(redis)
    );
    await runWithIdempotency(
      { isMutation: true, operationId: "op-B", userId: "user-1", next, ...RESULT_ADAPTERS },
      makeConfig(redis)
    );

    expect(calls).toBe(2);
  });

  it("scopes claims per user so the same operationId across users does not collide", async () => {
    const redis = createFakeRedis();
    let calls = 0;
    const next = async (): Promise<TestResult> => {
      calls++;

      return { ok: true, data: { n: calls } };
    };

    await runWithIdempotency(
      { isMutation: true, operationId: "shared-op", userId: "user-1", next, ...RESULT_ADAPTERS },
      makeConfig(redis)
    );
    await runWithIdempotency(
      { isMutation: true, operationId: "shared-op", userId: "user-2", next, ...RESULT_ADAPTERS },
      makeConfig(redis)
    );

    expect(calls).toBe(2);
  });

  it("passes through mutations without an operationId (never caches)", async () => {
    const redis = createFakeRedis();
    let calls = 0;
    const params = {
      isMutation: true,
      operationId: null,
      userId: "user-1",
      next: async (): Promise<TestResult> => {
        calls++;

        return { ok: true, data: { n: calls } };
      },
      ...RESULT_ADAPTERS,
    };

    await runWithIdempotency(params, makeConfig(redis));
    await runWithIdempotency(params, makeConfig(redis));

    expect(calls).toBe(2);
    expect(redis.store.size).toBe(0);
  });

  it("does not apply to queries even when an operationId is present", async () => {
    const redis = createFakeRedis();
    let calls = 0;
    const params = {
      isMutation: false,
      operationId: "op-query",
      userId: "user-1",
      next: async (): Promise<TestResult> => {
        calls++;

        return { ok: true, data: { n: calls } };
      },
      ...RESULT_ADAPTERS,
    };

    await runWithIdempotency(params, makeConfig(redis));
    await runWithIdempotency(params, makeConfig(redis));

    expect(calls).toBe(2);
    expect(redis.store.size).toBe(0);
  });

  it("round-trips complex types (Date) through the stored response via superjson", async () => {
    const redis = createFakeRedis();
    const when = new Date("2026-01-02T03:04:05.000Z");
    let calls = 0;
    const params = {
      isMutation: true,
      operationId: "op-date",
      userId: "user-1",
      next: async (): Promise<TestResult> => {
        calls++;

        return { ok: true, data: { when } };
      },
      ...RESULT_ADAPTERS,
    };

    await runWithIdempotency(params, makeConfig(redis));
    const cached = await runWithIdempotency(params, makeConfig(redis));

    expect(calls).toBe(1);
    const cachedWhen = (cached.data as { when: Date }).when;
    expect(cachedWhen).toBeInstanceOf(Date);
    expect(cachedWhen.toISOString()).toBe(when.toISOString());
  });

  it("does not cache a thrown handler — a later replay re-executes and can succeed", async () => {
    const redis = createFakeRedis();
    let calls = 0;
    const params = {
      isMutation: true,
      operationId: "op-throw",
      userId: "user-1",
      next: async (): Promise<TestResult> => {
        calls++;

        if (calls === 1) {
          throw new Error("boom");
        }

        return { ok: true, data: { n: calls } };
      },
      ...RESULT_ADAPTERS,
    };

    await expect(runWithIdempotency(params, makeConfig(redis))).rejects.toThrow("boom");
    // Claim was released, so nothing is memoized.
    expect(redis.store.size).toBe(0);

    const retry = await runWithIdempotency(params, makeConfig(redis));
    expect(calls).toBe(2);
    expect(retry.data).toEqual({ n: 2 });
  });

  it("does not cache an error result (ok:false) — a later replay re-executes", async () => {
    const redis = createFakeRedis();
    let calls = 0;
    const params = {
      isMutation: true,
      operationId: "op-err",
      userId: "user-1",
      next: async (): Promise<TestResult> => {
        calls++;

        return calls === 1 ? { ok: false, data: undefined } : { ok: true, data: { n: calls } };
      },
      ...RESULT_ADAPTERS,
    };

    const first = await runWithIdempotency(params, makeConfig(redis));
    expect(first.ok).toBe(false);

    const second = await runWithIdempotency(params, makeConfig(redis));
    expect(calls).toBe(2);
    expect(second.data).toEqual({ n: 2 });
  });

  it("executes the handler once under concurrent duplicate replays", async () => {
    const redis = createFakeRedis();
    let calls = 0;
    const params = {
      isMutation: true,
      operationId: "op-concurrent",
      userId: "user-1",
      next: async (): Promise<TestResult> => {
        calls++;
        // Hold the claim briefly so the racing call observes the pending sentinel.
        await new Promise((resolve) => setTimeout(resolve, 5));

        return { ok: true, data: { n: calls } };
      },
      ...RESULT_ADAPTERS,
    };

    const [a, b] = await Promise.all([
      runWithIdempotency(params, makeConfig(redis)),
      runWithIdempotency(params, makeConfig(redis)),
    ]);

    expect(calls).toBe(1);
    expect(a.data).toEqual({ n: 1 });
    expect(b.data).toEqual({ n: 1 });
  });
});

describe("withIdempotency (through a real tRPC procedure caller)", () => {
  // Exercises the synthetic `cachedMiddlewareResult` marker end-to-end: tRPC's
  // procedure caller rejects a result whose marker it doesn't recognise, so this
  // proves the short-circuit's marker is valid.
  it("returns the cached response without re-running the resolver", async () => {
    const redis = createFakeRedis();
    const config = makeConfig(redis);

    const t = initTRPC
      .context<{ operationId: string | null; user: { id: string } | null }>()
      .create({ transformer: superjson });

    const idempotency = t.middleware(({ ctx, type, next }) =>
      runWithIdempotency(
        {
          isMutation: type === "mutation",
          operationId: ctx.operationId,
          userId: ctx.user?.id,
          next,
          isOk: (result) => result.ok,
          getData: (result) => (result.ok ? result.data : undefined),
          toCachedResult: cachedMiddlewareResult,
        },
        config
      )
    );

    let calls = 0;
    const router = t.router({
      bump: t.procedure.use(idempotency).mutation(() => {
        calls++;

        return { n: calls, at: new Date("2026-03-04T05:06:07.000Z") };
      }),
    });

    const caller = router.createCaller({ operationId: "op-caller-1", user: { id: "user-1" } });

    const first = await caller.bump();
    const second = await caller.bump();

    expect(calls).toBe(1);
    expect(first).toEqual(second);
    expect(second.at).toBeInstanceOf(Date);
  });
});
