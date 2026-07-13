import { toast } from "@heroui/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QueuedDeliveryError } from "@norish/shared/lib/queued-delivery";

import { showSafeErrorToast, toSafeErrorDiagnostic } from "../../lib/ui/safe-error-toast";

const logError = vi.hoisted(() => vi.fn());

vi.mock("@norish/shared/lib/logger", () => ({
  createClientLogger: () => ({ error: logError }),
}));

vi.mock("@heroui/react", () => ({ toast: vi.fn() }));

describe("safe error toast diagnostics", () => {
  beforeEach(() => {
    logError.mockReset();
    vi.mocked(toast).mockReset();
  });

  it("normalizes nested tRPC-style errors without retaining raw data", () => {
    const cause = new TypeError("Failed to fetch");
    const error = Object.assign(new Error("Mutation request failed", { cause }), {
      data: {
        code: "INTERNAL_SERVER_ERROR",
        httpStatus: 500,
        privateResponse: { token: "do-not-log" },
      },
    });

    expect(toSafeErrorDiagnostic(error)).toEqual({
      name: "Error",
      message: "Mutation request failed",
      code: "INTERNAL_SERVER_ERROR",
      httpStatus: 500,
      cause: {
        name: "TypeError",
        message: "Failed to fetch",
        code: undefined,
        httpStatus: undefined,
        cause: undefined,
      },
    });
  });

  it("logs readable error details and keeps metadata separate", () => {
    showSafeErrorToast({
      title: "Operation failed",
      description: "Try again",
      error: { name: "Error", message: "Connection refused", code: "ECONNREFUSED" },
      metadata: { operation: "recipes.importFromUrl" },
      context: "recipes-mutations:importFromUrl",
    });

    expect(logError).toHaveBeenCalledWith(
      {
        error: {
          name: "Error",
          message: "Connection refused",
          code: "ECONNREFUSED",
          httpStatus: undefined,
          cause: undefined,
        },
        metadata: { operation: "recipes.importFromUrl" },
      },
      "recipes-mutations:importFromUrl"
    );
  });

  it("does not log or toast a durably queued mutation", () => {
    showSafeErrorToast({
      title: "Operation failed",
      description: "Try again",
      error: new QueuedDeliveryError({
        operationId: "operation-1",
        path: "recipes.importFromUrl",
        entryId: "entry-1",
      }),
    });

    expect(logError).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });
});
