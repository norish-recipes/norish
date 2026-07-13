import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Context } from "../src/context";
import { authedProcedure } from "../src/middleware";
import { router } from "../src/trpc";

const receiptMocks = vi.hoisted(() => ({
  claim: vi.fn(),
  complete: vi.fn(),
  release: vi.fn(),
}));
const transactionEvents = vi.hoisted(() => [] as string[]);

vi.mock("@norish/db/repositories/mutation-receipts", () => ({
  claimMutationReceipt: receiptMocks.claim,
  completeMutationReceipt: receiptMocks.complete,
  releaseMutationReceipt: receiptMocks.release,
}));

vi.mock("@norish/db/drizzle", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/db/drizzle")>()),
  withTransaction: async (callback: (tx: object) => Promise<unknown>) => {
    try {
      const result = await callback({});

      transactionEvents.push("commit");

      return result;
    } catch (error) {
      transactionEvents.push("rollback");
      throw error;
    }
  },
}));

vi.mock("@norish/shared-server/cache/household", () => ({
  getCachedHouseholdForUser: vi.fn().mockResolvedValue(null),
}));

function createContext(overrides: Partial<Context> = {}): Context {
  return {
    user: {
      id: "user-1",
      email: "user@example.test",
      name: "User",
      image: null,
      version: 1,
    },
    household: null,
    connectionId: null,
    multiplexer: null,
    operationId: "00000000-0000-4000-8000-000000000001",
    enforceMutationReceipts: true,
    ...overrides,
  };
}

describe("mutation receipt orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    transactionEvents.length = 0;
  });

  it("returns the exact encrypted result for a duplicate without rerunning the resolver", async () => {
    const resolver = vi.fn(async () => ({ createdAt: new Date("2026-07-10T00:00:00Z") }));
    const testRouter = router({ mutate: authedProcedure.mutation(resolver) });
    const caller = testRouter.createCaller(createContext());

    receiptMocks.claim.mockResolvedValueOnce({
      kind: "claimed",
      receiptId: "receipt-1",
      recovered: false,
    });
    receiptMocks.complete.mockResolvedValueOnce(true);
    await caller.mutate();

    const storedResponse = receiptMocks.complete.mock.calls[0]?.[1];
    receiptMocks.claim.mockResolvedValueOnce({
      kind: "completed",
      responseEncrypted: storedResponse,
    });

    const duplicate = await caller.mutate();

    expect(duplicate).toEqual({ createdAt: new Date("2026-07-10T00:00:00Z") });
    expect(resolver).toHaveBeenCalledOnce();
  });

  it("rejects changed intent and suppresses concurrent duplicate execution", async () => {
    const resolver = vi.fn(async () => ({ success: true }));
    const testRouter = router({ mutate: authedProcedure.mutation(resolver) });
    const caller = testRouter.createCaller(createContext());

    receiptMocks.claim.mockResolvedValueOnce({ kind: "conflict" });
    await expect(caller.mutate()).rejects.toMatchObject({ code: "CONFLICT" });

    receiptMocks.claim.mockResolvedValueOnce({ kind: "in-progress", retryAfterMs: 250 });
    await expect(caller.mutate()).rejects.toMatchObject({ code: "TIMEOUT" });
    expect(resolver).not.toHaveBeenCalled();
  });

  it("releases a claimed receipt when the resolver returns an error result", async () => {
    const testRouter = router({
      user: router({
        apiKeys: router({
          create: authedProcedure.mutation(async () => {
            throw new Error("domain failure");
          }),
        }),
      }),
    });
    const caller = testRouter.createCaller(createContext());

    receiptMocks.claim.mockResolvedValueOnce({
      kind: "claimed",
      receiptId: "receipt-2",
      recovered: false,
    });
    await expect(caller.user.apiKeys.create()).rejects.toThrow("domain failure");
    expect(receiptMocks.release).toHaveBeenCalledWith("receipt-2");
  });

  it("rolls back a PostgreSQL transaction when the resolver returns an error result", async () => {
    const testRouter = router({
      user: router({
        updateName: authedProcedure.mutation(async () => {
          throw new Error("domain failure");
        }),
      }),
    });
    const caller = testRouter.createCaller(createContext());

    receiptMocks.claim.mockResolvedValueOnce({
      kind: "claimed",
      receiptId: "receipt-postgresql-error",
      recovered: false,
    });

    await expect(caller.user.updateName()).rejects.toThrow("domain failure");
    expect(transactionEvents).toEqual(["rollback"]);
    expect(receiptMocks.release).not.toHaveBeenCalled();
  });
});
