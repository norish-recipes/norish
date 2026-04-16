import { observable, observableToPromise } from "@trpc/server/observable";
import { describe, expect, it, vi } from "vitest";

import { createOperationIdLink, OPERATION_ID_HEADER } from "./operation-id-link";
import { createRequestHeadersResolver } from "./request-headers";

describe("createOperationIdLink", () => {
  it("attaches a generated operationId to mutation context and request headers", async () => {
    let forwardedOp: {
      context?: Record<string, unknown>;
    } | null = null;

    const next = vi.fn((op) => {
      forwardedOp = op;

      return observable((observer) => {
        observer.next({
          result: {
            type: "data",
            data: { ok: true },
          },
        } as never);
        observer.complete();
      });
    });

    const link = createOperationIdLink()({});

    await observableToPromise(
      link({
        op: {
          id: 1,
          type: "mutation",
          path: "recipes.create",
          input: { name: "Soup" },
          context: {},
          signal: null,
        },
        next,
      })
    );

    expect(next).toHaveBeenCalledOnce();
    expect(typeof forwardedOp?.context?.operationId).toBe("string");

    const headers = createRequestHeadersResolver(() => ({ authorization: "Bearer token" }))({
      op: forwardedOp ?? {},
    });

    expect(headers.authorization).toBe("Bearer token");
    expect(headers[OPERATION_ID_HEADER]).toBe(forwardedOp?.context?.operationId);
  });

  it("preserves a caller-supplied operationId", async () => {
    const operationId = "precomputed-op-id";
    let forwardedOp: {
      context?: Record<string, unknown>;
    } | null = null;

    const next = vi.fn((op) => {
      forwardedOp = op;

      return observable((observer) => {
        observer.next({
          result: {
            type: "data",
            data: { ok: true },
          },
        } as never);
        observer.complete();
      });
    });

    const link = createOperationIdLink()({});

    await observableToPromise(
      link({
        op: {
          id: 2,
          type: "mutation",
          path: "recipes.create",
          input: { name: "Soup" },
          context: { operationId },
          signal: null,
        },
        next,
      })
    );

    const headers = createRequestHeadersResolver(() => ({}))({
      op: forwardedOp ?? {},
    });

    expect(forwardedOp?.context?.operationId).toBe(operationId);
    expect(headers[OPERATION_ID_HEADER]).toBe(operationId);
  });

  it("passes non-mutation operations through unchanged", async () => {
    const next = vi.fn((op) =>
      observable((observer) => {
        observer.next({
          result: {
            type: "data",
            data: op,
          },
        } as never);
        observer.complete();
      })
    );

    const link = createOperationIdLink()({});

    await observableToPromise(
      link({
        op: {
          id: 3,
          type: "query",
          path: "recipes.list",
          input: undefined,
          context: {},
          signal: null,
        },
        next,
      })
    );

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "query",
        context: {},
      })
    );
  });
});
