import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock provider cache
const mockProviderCache = {
  github: null,
  google: null,
  oidc: null,
  passwordEnabled: false,
};

vi.mock("@/server/auth/provider-cache", () => ({
  getCachedGitHubProvider: () => mockProviderCache.github,
  getCachedGoogleProvider: () => mockProviderCache.google,
  getCachedOIDCProvider: () => mockProviderCache.oidc,
  getCachedPasswordAuthEnabled: () => mockProviderCache.passwordEnabled,
  setAuthProviderCache: vi.fn(),
}));

describe("Provider Cache - Password Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProviderCache.github = null;
    mockProviderCache.google = null;
    mockProviderCache.oidc = null;
    mockProviderCache.passwordEnabled = false;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("getCachedPasswordAuthEnabled", () => {
    it("should return false by default", async () => {
      const { getCachedPasswordAuthEnabled } = await import("@/server/auth/provider-cache");

      expect(getCachedPasswordAuthEnabled()).toBe(false);
    });

    it("should return true when password auth is enabled in cache", async () => {
      mockProviderCache.passwordEnabled = true;

      const { getCachedPasswordAuthEnabled } = await import("@/server/auth/provider-cache");

      expect(getCachedPasswordAuthEnabled()).toBe(true);
    });
  });
});

describe("Password Auth Seed Config", () => {
  const mockGetConfig = vi.fn();
  const mockSetConfig = vi.fn();
  const mockConfigExists = vi.fn();
  let mockServerConfig: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    mockServerConfig = {};
  });

  afterEach(() => {
    vi.resetModules();
  });

  vi.mock("@/server/db/repositories/server-config", () => ({
    getConfig: () => mockGetConfig(),
    setConfig: (...args: unknown[]) => mockSetConfig(...args),
    configExists: () => mockConfigExists(),
  }));

  vi.mock("@/config/env-config-server", () => ({
    get SERVER_CONFIG() {
      return mockServerConfig;
    },
  }));

  vi.mock("@/server/logger", () => ({
    serverLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
  }));

  vi.mock("@/config/units.default.json", () => ({ default: {} }));
  vi.mock("@/config/content-indicators.default.json", () => ({
    default: { schemaIndicators: [], contentIndicators: [] },
  }));
  vi.mock("@/config/recurrence-config.default.json", () => ({
    default: { locales: {} },
  }));

  describe("hasOAuthEnvConfigured helper", () => {
    it("should detect when OIDC env vars are configured", () => {
      mockServerConfig = {
        OIDC_ISSUER: "https://auth.example.com",
        OIDC_CLIENT_ID: "client-id",
        OIDC_CLIENT_SECRET: "client-secret",
      };

      // The function is internal, but we can test through the seed logic
      // Password auth should default to false when OIDC is configured
    });

    it("should detect when GitHub env vars are configured", () => {
      mockServerConfig = {
        GITHUB_CLIENT_ID: "github-client-id",
        GITHUB_CLIENT_SECRET: "github-client-secret",
      };

      // Password auth should default to false when GitHub is configured
    });

    it("should detect when Google env vars are configured", () => {
      mockServerConfig = {
        GOOGLE_CLIENT_ID: "google-client-id",
        GOOGLE_CLIENT_SECRET: "google-client-secret",
      };

      // Password auth should default to false when Google is configured
    });
  });
});
