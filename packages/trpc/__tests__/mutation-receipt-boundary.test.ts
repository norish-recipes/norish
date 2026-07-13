import { describe, expect, it, vi } from "vitest";

import type { Context } from "../src/context";
import { authedProcedure } from "../src/middleware";
import { router } from "../src/trpc";

function createContext(overrides: Partial<Context> = {}): Context {
  return {
    user: {
      id: "user-1",
      email: "user@example.test",
      name: "User",
      image: null,
      version: 1,
    },
    household: { id: "household-1", name: "Home", users: [] },
    connectionId: null,
    multiplexer: null,
    operationId: null,
    enforceMutationReceipts: true,
    ...overrides,
  };
}

describe("mutation receipt boundary", () => {
  it("rejects a missing operation ID before the mutation resolver executes", async () => {
    const resolver = vi.fn(async () => ({ success: true }));
    const testRouter = router({ mutate: authedProcedure.mutation(resolver) });
    const caller = testRouter.createCaller(createContext());

    await expect(caller.mutate()).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(resolver).not.toHaveBeenCalled();
  });

  it("leaves caller-side tests and internal calls opt-in to HTTP enforcement", async () => {
    const resolver = vi.fn(async () => ({ success: true }));
    const testRouter = router({ mutate: authedProcedure.mutation(resolver) });
    const caller = testRouter.createCaller(
      createContext({ enforceMutationReceipts: false, operationId: null })
    );

    await expect(caller.mutate()).resolves.toEqual({ success: true });
    expect(resolver).toHaveBeenCalledOnce();
  });
});
