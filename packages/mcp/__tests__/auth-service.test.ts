import { describe, expect, it } from "vitest";

import type { ApiKeyAuthService, ApiKeyVerifyResult } from "@norish/shared/contracts/dto/auth";
import { setApiKeyAuthService, verifyApiKeyForRequest } from "@norish/db/repositories/api-keys";

const results: Record<string, ApiKeyVerifyResult> = {
  valid: { valid: true, key: { referenceId: "user-1" } },
  expired: { valid: false, key: null, error: { code: "KEY_EXPIRED" } },
  disabled: { valid: false, key: null, error: { code: "KEY_DISABLED" } },
  limited: {
    valid: false,
    key: null,
    error: { code: "RATE_LIMITED", details: { tryAgainIn: 120_000 } },
  },
  limitedWithoutDetails: { valid: false, key: null, error: { code: "RATE_LIMITED" } },
  unknown: { valid: false, key: null, error: { code: "INVALID_API_KEY" } },
};

const fakeService: ApiKeyAuthService = {
  createApiKey: () => Promise.reject(new Error("not used")),
  verifyApiKey: async ({ body }) => {
    if (body.key === "throws") throw new Error("database unavailable");

    return results[body.key] ?? { valid: false, key: null };
  },
};

setApiKeyAuthService(fakeService);

describe("API key verification mapping", () => {
  it("returns the user id for a valid key", async () => {
    await expect(verifyApiKeyForRequest("valid")).resolves.toEqual({
      status: "valid",
      userId: "user-1",
    });
  });

  it("rejects an expired key", async () => {
    await expect(verifyApiKeyForRequest("expired")).resolves.toEqual({ status: "invalid" });
  });

  it("rejects a disabled key", async () => {
    await expect(verifyApiKeyForRequest("disabled")).resolves.toEqual({ status: "invalid" });
  });

  it("carries the plugin retry time for a rate-limited key", async () => {
    await expect(verifyApiKeyForRequest("limited")).resolves.toEqual({
      status: "rate_limited",
      retryAfterSeconds: 120,
    });
  });

  it("uses a one-minute retry time when the plugin omits it", async () => {
    await expect(verifyApiKeyForRequest("limitedWithoutDetails")).resolves.toEqual({
      status: "rate_limited",
      retryAfterSeconds: 60,
    });
  });

  it("rejects an unknown key error", async () => {
    await expect(verifyApiKeyForRequest("unknown")).resolves.toEqual({ status: "invalid" });
  });

  it("rejects when the auth service throws", async () => {
    await expect(verifyApiKeyForRequest("throws")).resolves.toEqual({ status: "invalid" });
  });
});
