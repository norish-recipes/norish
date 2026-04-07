import { TRPCClientError } from "@trpc/client";
import { describe, expect, it, vi } from "vitest";

import { isBackendUnreachableError } from "../../src/lib/outbox/error-classification";

vi.mock("@norish/shared/lib/logger", () => ({
  createClientLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe("error-classification", () => {
  describe("isBackendUnreachableError", () => {
    it('returns true for TypeError with "fetch failed"', () => {
      const error = new TypeError("fetch failed");

      expect(isBackendUnreachableError(error)).toBe(true);
    });

    it('returns true for TypeError with "Network request failed"', () => {
      const error = new TypeError("Network request failed");

      expect(isBackendUnreachableError(error)).toBe(true);
    });

    it('returns true for TypeError with "Failed to fetch"', () => {
      const error = new TypeError("Failed to fetch");

      expect(isBackendUnreachableError(error)).toBe(true);
    });

    it('returns true for TypeError with "Load failed"', () => {
      const error = new TypeError("Load failed");

      expect(isBackendUnreachableError(error)).toBe(true);
    });

    it("returns true for TRPCClientError wrapping a network TypeError", () => {
      const cause = new TypeError("fetch failed");
      const error = new TRPCClientError("Request failed", { cause });

      expect(isBackendUnreachableError(error)).toBe(true);
    });

    it("returns true for TRPCClientError without HTTP status (server never responded)", () => {
      const error = new TRPCClientError("Something went wrong");

      expect(isBackendUnreachableError(error)).toBe(true);
    });

    it("returns false for TRPCClientError with HTTP status (server responded)", () => {
      const error = new TRPCClientError("Unauthorized", {
        result: {
          error: {
            json: {
              code: -32001,
              message: "UNAUTHORIZED",
              data: { httpStatus: 401, code: "UNAUTHORIZED" },
            },
          },
        },
      } as never);

      Object.defineProperty(error, "data", {
        value: { httpStatus: 401, code: "UNAUTHORIZED" },
        configurable: true,
      });

      expect(isBackendUnreachableError(error)).toBe(false);
    });

    it("returns false for regular errors", () => {
      const error = new Error("Some random error");

      expect(isBackendUnreachableError(error)).toBe(false);
    });

    it("returns false for null/undefined", () => {
      expect(isBackendUnreachableError(null)).toBe(false);
      expect(isBackendUnreachableError(undefined)).toBe(false);
    });

    it("returns false for non-network TypeError", () => {
      const error = new TypeError("Cannot read properties of undefined");

      expect(isBackendUnreachableError(error)).toBe(false);
    });
  });
});
