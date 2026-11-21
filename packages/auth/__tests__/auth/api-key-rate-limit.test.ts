// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiKeyRetryAfter, consumeApiKeyRequest } from "@norish/auth/api-key-rate-limit";

const valkey = vi.hoisted(() => ({ eval: vi.fn(), ttl: vi.fn() }));
const config = vi.hoisted(() => ({ API_KEY_RATE_LIMIT_WINDOW: 3600, API_KEY_RATE_LIMIT_MAX: 500 }));

vi.mock("@norish/config/env-config-server", () => ({ SERVER_CONFIG: config }));

vi.mock("@norish/shared-server/valkey/client", () => ({
  getPublisherClient: async () => valkey,
}));

beforeEach(() => {
  config.API_KEY_RATE_LIMIT_WINDOW = 3600;
  config.API_KEY_RATE_LIMIT_MAX = 500;
  valkey.eval.mockReset();
  valkey.ttl.mockReset();
});

describe("consumeApiKeyRequest", () => {
  it("lets the 500th request of a window through", async () => {
    valkey.eval.mockResolvedValue(500);

    await expect(consumeApiKeyRequest("secret-key")).resolves.toBe(true);
    // A fixed hourly window, counted under a hash rather than the key itself.
    expect(valkey.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      expect.not.stringContaining("secret-key"),
      3600
    );
  });

  it("refuses the 501st with the seconds left in the window", async () => {
    valkey.eval.mockResolvedValue(501);
    valkey.ttl.mockResolvedValue(1200);

    const error = await consumeApiKeyRequest("secret-key").catch((cause: unknown) => cause);

    expect(apiKeyRetryAfter(error)).toBe("1200");
  });

  it("counts in the window and up to the ceiling the server configures", async () => {
    config.API_KEY_RATE_LIMIT_WINDOW = 60;
    config.API_KEY_RATE_LIMIT_MAX = 1000;
    valkey.eval.mockResolvedValue(1000);

    await expect(consumeApiKeyRequest("secret-key")).resolves.toBe(true);
    expect(valkey.eval).toHaveBeenCalledWith(expect.any(String), 1, expect.any(String), 60);
  });
});

describe("apiKeyRetryAfter", () => {
  it("is null for any other error", () => {
    expect(apiKeyRetryAfter(new Error("boom"))).toBeNull();
  });
});
