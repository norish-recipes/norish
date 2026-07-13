import { TRPCClientError } from "@trpc/client";
import { describe, expect, it } from "vitest";

import { isQueuedDeliveryError, QueuedDeliveryError } from "@norish/shared/lib/queued-delivery";
import { isBackendUnreachableError } from "@norish/shared/lib/trpc-errors";

describe("backend reachability classification", () => {
  it("captures fetch and network failures but not domain errors", () => {
    expect(isBackendUnreachableError(new TypeError("Failed to fetch"))).toBe(true);
    expect(
      isBackendUnreachableError(new TypeError("NetworkError when attempting to fetch resource."))
    ).toBe(true);
    expect(isBackendUnreachableError(new Error("connection refused"))).toBe(true);
    expect(isBackendUnreachableError(new Error("Validation failed"))).toBe(false);
    expect(isBackendUnreachableError({ data: { code: "CONFLICT" } })).toBe(false);
  });

  it("recognizes Firefox network failures after tRPC wrapping", () => {
    const firefoxNetworkError = new TypeError("NetworkError when attempting to fetch resource.");

    expect(isBackendUnreachableError(TRPCClientError.from(firefoxNetworkError))).toBe(true);
  });

  it("does not recursively capture an already queued delivery", () => {
    expect(
      isBackendUnreachableError(
        new QueuedDeliveryError({
          operationId: "operation-1",
          path: "groceries.update",
          entryId: "entry-1",
        })
      )
    ).toBe(false);
  });

  it("recognizes queued delivery errors wrapped by the tRPC client", () => {
    const queued = new QueuedDeliveryError({
      operationId: "operation-1",
      path: "groceries.update",
      entryId: "entry-1",
    });
    const wrapped = TRPCClientError.from(queued);

    expect(isQueuedDeliveryError(wrapped)).toBe(true);
    expect(isBackendUnreachableError(wrapped)).toBe(false);
  });
});
