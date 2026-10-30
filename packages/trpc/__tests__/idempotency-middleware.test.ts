// @vitest-environment node
import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { describe, expect, it } from "vitest";

import type { IdempotencyConfig, IdempotencyValkey } from "../src/idempotency-middleware";
import {
  cachedMiddlewareResult,
  IDEMPOTENCY_CLAIM_TTL_SECONDS,
  IDEMPOTENCY_TTL_SECONDS,
  runWithIdempotency,
} from "../src/idempotency-middleware";

/**
 * Minimal in-memory Valkey honouring the `SET ... EX ... NX` semantics the
 * middleware relies on. Keys expire against `now`, which a test moves by hand.
 */
function createFakeValkey(): IdempotencyValkey & {
  store: Map<string, string>;
  ttls: Map<string, number>;
  advance: (seconds: number) => void;
} {
  const store = new Map<string, string>();
  const ttls = new Map<string, number>();
  const expiresAt = new Map<string, number>();
  let now = 0;

  const expire = () => {
    for (const [key, at] of expiresAt) {
      if (at <= now) {
        store.delete(key);
        expiresAt.delete(key);
      }
    }
  };

  return {
    store,
    ttls,
    advance(seconds: number) {
      now += seconds;
      expire();
    },
    async set(key: string, value: string, ...args: unknown[]) {
      const nx = args.includes("NX");

      if (nx && store.has(key)) {
        return null;
      }

      store.set(key, value);

      const ttl = args[args.indexOf("EX") + 1];

      if (args.includes("EX") && typeof ttl === "number") {
        ttls.set(key, ttl);
        expiresAt.set(key, now + ttl);
      }

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

function makeConfig(valkey: IdempotencyValkey): IdempotencyConfig {
  return {
    getValkey: async () => valkey,
    claimTtlSeconds: IDEMPOTENCY_CLAIM_TTL_SECONDS,
    ttlSeconds: IDEMPOTENCY_TTL_SECONDS,
    pollIntervalMs: 1,
    pollMaxAttempts: 50,
  };
}

const RESULT_ADAPTERS = {
  isOk: (result: TestResult) => result.ok,
  getData: (result: TestResult) => result.data,
  toCachedResult: (data: unknown): TestResult => ({ ok: true, data }),
};

describe("runWithIdempotency", () => {
  it("executes the handler once and returns the stored response for a duplicate operationId (the replay case)", async () => {
    const valkey = createFakeValkey();
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

    const first = await runWithIdempotency(params, makeConfig(valkey));
    const second = await runWithIdempotency(params, makeConfig(valkey));

    expect(calls).toBe(1);
    expect(first.data).toEqual({ n: 1 });
    expect(second.data).toEqual({ n: 1 });
  });

  it("executes independently for different operationIds", async () => {
    const valkey = createFakeValkey();
    let calls = 0;
    const next = async (): Promise<TestResult> => {
      calls++;

      return { ok: true, data: { n: calls } };
    };

    await runWithIdempotency(
      { isMutation: true, operationId: "op-A", userId: "user-1", next, ...RESULT_ADAPTERS },
      makeConfig(valkey)
    );
    await runWithIdempotency(
      { isMutation: true, operationId: "op-B", userId: "user-1", next, ...RESULT_ADAPTERS },
      makeConfig(valkey)
    );

    expect(calls).toBe(2);
  });

  it("scopes claims per user so the same operationId across users does not collide", async () => {
    const valkey = createFakeValkey();
    let calls = 0;
    const next = async (): Promise<TestResult> => {
      calls++;

      return { ok: true, data: { n: calls } };
    };

    await runWithIdempotency(
      { isMutation: true, operationId: "shared-op", userId: "user-1", next, ...RESULT_ADAPTERS },
      makeConfig(valkey)
    );
    await runWithIdempotency(
      { isMutation: true, operationId: "shared-op", userId: "user-2", next, ...RESULT_ADAPTERS },
      makeConfig(valkey)
    );

    expect(calls).toBe(2);
  });

  it("passes through mutations without an operationId (never caches)", async () => {
    const valkey = createFakeValkey();
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

    await runWithIdempotency(params, makeConfig(valkey));
    await runWithIdempotency(params, makeConfig(valkey));

    expect(calls).toBe(2);
    expect(valkey.store.size).toBe(0);
  });

  it("does not apply to queries even when an operationId is present", async () => {
    const valkey = createFakeValkey();
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

    await runWithIdempotency(params, makeConfig(valkey));
    await runWithIdempotency(params, makeConfig(valkey));

    expect(calls).toBe(2);
    expect(valkey.store.size).toBe(0);
  });

  it("round-trips complex types (Date) through the stored response via superjson", async () => {
    const valkey = createFakeValkey();
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

    await runWithIdempotency(params, makeConfig(valkey));
    const cached = await runWithIdempotency(params, makeConfig(valkey));

    expect(calls).toBe(1);
    const cachedWhen = (cached.data as { when: Date }).when;
    expect(cachedWhen).toBeInstanceOf(Date);
    expect(cachedWhen.toISOString()).toBe(when.toISOString());
  });

  it("does not cache a thrown handler — a later replay re-executes and can succeed", async () => {
    const valkey = createFakeValkey();
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

    await expect(runWithIdempotency(params, makeConfig(valkey))).rejects.toThrow("boom");
    // Claim was released, so nothing is memoized.
    expect(valkey.store.size).toBe(0);

    const retry = await runWithIdempotency(params, makeConfig(valkey));
    expect(calls).toBe(2);
    expect(retry.data).toEqual({ n: 2 });
  });

  it("does not cache an error result (ok:false) — a later replay re-executes", async () => {
    const valkey = createFakeValkey();
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

    const first = await runWithIdempotency(params, makeConfig(valkey));
    expect(first.ok).toBe(false);

    const second = await runWithIdempotency(params, makeConfig(valkey));
    expect(calls).toBe(2);
    expect(second.data).toEqual({ n: 2 });
  });

  it("executes the handler once under concurrent duplicate replays", async () => {
    const valkey = createFakeValkey();
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
      runWithIdempotency(params, makeConfig(valkey)),
      runWithIdempotency(params, makeConfig(valkey)),
    ]);

    expect(calls).toBe(1);
    expect(a.data).toEqual({ n: 1 });
    expect(b.data).toEqual({ n: 1 });
  });

  it("lets a claim whose owner never finishes expire after five minutes, so a retry runs", async () => {
    const valkey = createFakeValkey();
    const key = "norish:idempotency:user-1:op-orphaned";
    let calls = 0;
    const params = (next: () => Promise<TestResult>) => ({
      isMutation: true,
      operationId: "op-orphaned",
      userId: "user-1",
      next,
      ...RESULT_ADAPTERS,
    });

    // The owning request dies mid-handler, as in a crash or restart.
    void runWithIdempotency(
      params(() => new Promise<TestResult>(() => {})),
      makeConfig(valkey)
    );
    await expect.poll(() => valkey.store.has(key)).toBe(true);
    expect(IDEMPOTENCY_CLAIM_TTL_SECONDS).toBe(5 * 60);
    expect(valkey.ttls.get(key)).toBe(IDEMPOTENCY_CLAIM_TTL_SECONDS);

    valkey.advance(IDEMPOTENCY_CLAIM_TTL_SECONDS);

    const retried = await runWithIdempotency(
      params(async () => {
        calls++;

        return { ok: true, data: { n: calls } };
      }),
      makeConfig(valkey)
    );

    expect(retried.data).toEqual({ n: 1 });
  });

  it("keeps a completed response for seven days", async () => {
    const valkey = createFakeValkey();
    const key = "norish:idempotency:user-1:op-done";

    await runWithIdempotency(
      {
        isMutation: true,
        operationId: "op-done",
        userId: "user-1",
        next: async (): Promise<TestResult> => ({ ok: true, data: { n: 1 } }),
        ...RESULT_ADAPTERS,
      },
      makeConfig(valkey)
    );

    expect(valkey.ttls.get(key)).toBe(7 * 24 * 60 * 60);
    valkey.advance(IDEMPOTENCY_TTL_SECONDS - 1);
    expect(valkey.store.has(key)).toBe(true);
  });
});

describe("withIdempotency (through a real tRPC procedure caller)", () => {
  // Exercises the synthetic `cachedMiddlewareResult` marker end-to-end: tRPC's
  // procedure caller rejects a result whose marker it doesn't recognise, so this
  // proves the short-circuit's marker is valid.
  it("returns the cached response without re-running the resolver", async () => {
    const valkey = createFakeValkey();
    const config = makeConfig(valkey);

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
