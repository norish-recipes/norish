import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// === Mocks ===

const mockGetConfig = vi.fn();
const mockSetConfig = vi.fn();
const mockConfigExists = vi.fn();
let mockServerConfig: Record<string, string | undefined> = {};

vi.mock("@/server/db/repositories/server-config", () => ({
  getConfig: mockGetConfig,
  setConfig: mockSetConfig,
  configExists: mockConfigExists,
}));

vi.mock("@/server/auth/provider-cache", () => ({
  setAuthProviderCache: vi.fn(),
}));

vi.mock("@/server/logger", () => ({
  serverLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/config/env-config-server", () => ({
  get SERVER_CONFIG() {
    return mockServerConfig;
  },
}));

vi.mock("@/config/units.default.json", () => ({ default: {} }));
vi.mock("@/config/content-indicators.default.json", () => ({
  default: { schemaIndicators: [], contentIndicators: [] },
}));
vi.mock("@/config/recurrence-config.default.json", () => ({
  default: { locales: {} },
}));

import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";

describe("Auth Provider Sync Logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServerConfig = {};
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("OIDC Provider Sync", () => {
    const oidcEnvConfig = {
      OIDC_NAME: "TestOIDC",
      OIDC_ISSUER: "https://auth.example.com",
      OIDC_CLIENT_ID: "test-client-id",
      OIDC_CLIENT_SECRET: "test-client-secret",
      OIDC_WELLKNOWN: "https://auth.example.com/custom/.well-known/openid-configuration",
    };

    it("should insert OIDC config from env when DB row does not exist", async () => {
      // Arrange
      mockServerConfig = oidcEnvConfig;
      mockGetConfig.mockResolvedValue(null);
      mockConfigExists.mockResolvedValue(true);
      const { seedServerConfig } = await import("@/server/startup/seed-config");

      // Act
      await seedServerConfig();

      // Assert
      const oidcCall = mockSetConfig.mock.calls.find(
        (call) => call[0] === ServerConfigKeys.AUTH_PROVIDER_OIDC
      );

      expect(oidcCall).toBeDefined();
      expect(oidcCall![1]).toMatchObject({
        name: "TestOIDC",
        issuer: "https://auth.example.com",
        clientId: "test-client-id",
        clientSecret: "test-client-secret",
        wellknown: "https://auth.example.com/custom/.well-known/openid-configuration",
        isOverridden: false,
      });
    });

    it("should update OIDC config from env when isOverridden=false and env differs", async () => {
      // Arrange
      mockServerConfig = oidcEnvConfig;
      mockGetConfig.mockImplementation((key: string) => {
        if (key === ServerConfigKeys.AUTH_PROVIDER_OIDC) {
          return Promise.resolve({
            name: "OldOIDC",
            issuer: "https://old-auth.example.com",
            clientId: "old-client-id",
            clientSecret: "old-client-secret",
            wellknown: undefined,
            isOverridden: false,
          });
        }

        return Promise.resolve(null);
      });
      mockConfigExists.mockResolvedValue(true);
      const { seedServerConfig } = await import("@/server/startup/seed-config");

      // Act
      await seedServerConfig();

      // Assert
      const oidcCall = mockSetConfig.mock.calls.find(
        (call) => call[0] === ServerConfigKeys.AUTH_PROVIDER_OIDC
      );

      expect(oidcCall).toBeDefined();
      expect(oidcCall![1]).toMatchObject({
        name: "TestOIDC",
        issuer: "https://auth.example.com",
        wellknown: "https://auth.example.com/custom/.well-known/openid-configuration",
        isOverridden: false,
      });
    });

    it("should NOT update OIDC config when isOverridden=true", async () => {
      // Arrange
      mockServerConfig = oidcEnvConfig;
      mockGetConfig.mockImplementation((key: string) => {
        if (key === ServerConfigKeys.AUTH_PROVIDER_OIDC) {
          return Promise.resolve({
            name: "AdminEditedOIDC",
            issuer: "https://admin-set-auth.example.com",
            clientId: "admin-client-id",
            clientSecret: "admin-client-secret",
            isOverridden: true,
          });
        }

        return Promise.resolve(null);
      });
      mockConfigExists.mockResolvedValue(true);
      const { seedServerConfig } = await import("@/server/startup/seed-config");

      // Act
      await seedServerConfig();

      // Assert
      const oidcCall = mockSetConfig.mock.calls.find(
        (call) => call[0] === ServerConfigKeys.AUTH_PROVIDER_OIDC
      );

      expect(oidcCall).toBeUndefined();
    });

    it("should NOT update when env matches DB (no unnecessary writes)", async () => {
      // Arrange
      mockServerConfig = oidcEnvConfig;
      mockGetConfig.mockImplementation((key: string) => {
        if (key === ServerConfigKeys.AUTH_PROVIDER_OIDC) {
          return Promise.resolve({
            name: "TestOIDC",
            issuer: "https://auth.example.com",
            clientId: "test-client-id",
            clientSecret: "test-client-secret",
            wellknown: "https://auth.example.com/custom/.well-known/openid-configuration",
            isOverridden: false,
          });
        }

        return Promise.resolve(null);
      });
      mockConfigExists.mockResolvedValue(true);
      const { seedServerConfig } = await import("@/server/startup/seed-config");

      // Act
      await seedServerConfig();

      // Assert
      const oidcCall = mockSetConfig.mock.calls.find(
        (call) => call[0] === ServerConfigKeys.AUTH_PROVIDER_OIDC
      );

      expect(oidcCall).toBeUndefined();
    });

    it("should use OIDC_WELLKNOWN when provided in env", async () => {
      // Arrange
      const customWellknown =
        "https://auth.example.com/application/o/myapp/.well-known/openid-configuration";

      mockServerConfig = { ...oidcEnvConfig, OIDC_WELLKNOWN: customWellknown };
      mockGetConfig.mockResolvedValue(null);
      mockConfigExists.mockResolvedValue(true);
      const { seedServerConfig } = await import("@/server/startup/seed-config");

      // Act
      await seedServerConfig();

      // Assert
      const oidcCall = mockSetConfig.mock.calls.find(
        (call) => call[0] === ServerConfigKeys.AUTH_PROVIDER_OIDC
      );

      expect(oidcCall).toBeDefined();
      expect(oidcCall![1].wellknown).toBe(customWellknown);
    });
  });

  describe("GitHub Provider Sync", () => {
    const githubEnvConfig = {
      GITHUB_CLIENT_ID: "github-client-id",
      GITHUB_CLIENT_SECRET: "github-client-secret",
    };

    it("should insert GitHub config from env when DB row does not exist", async () => {
      // Arrange
      mockServerConfig = githubEnvConfig;
      mockGetConfig.mockResolvedValue(null);
      mockConfigExists.mockResolvedValue(true);
      const { seedServerConfig } = await import("@/server/startup/seed-config");

      // Act
      await seedServerConfig();

      // Assert
      const githubCall = mockSetConfig.mock.calls.find(
        (call) => call[0] === ServerConfigKeys.AUTH_PROVIDER_GITHUB
      );

      expect(githubCall).toBeDefined();
      expect(githubCall![1]).toMatchObject({
        clientId: "github-client-id",
        clientSecret: "github-client-secret",
        isOverridden: false,
      });
    });

    it("should NOT update GitHub config when isOverridden=true", async () => {
      // Arrange
      mockServerConfig = githubEnvConfig;
      mockGetConfig.mockImplementation((key: string) => {
        if (key === ServerConfigKeys.AUTH_PROVIDER_GITHUB) {
          return Promise.resolve({
            clientId: "admin-github-id",
            clientSecret: "admin-github-secret",
            isOverridden: true,
          });
        }

        return Promise.resolve(null);
      });
      mockConfigExists.mockResolvedValue(true);
      const { seedServerConfig } = await import("@/server/startup/seed-config");

      // Act
      await seedServerConfig();

      // Assert
      const githubCall = mockSetConfig.mock.calls.find(
        (call) => call[0] === ServerConfigKeys.AUTH_PROVIDER_GITHUB
      );

      expect(githubCall).toBeUndefined();
    });
  });

  describe("Google Provider Sync", () => {
    const googleEnvConfig = {
      GOOGLE_CLIENT_ID: "google-client-id",
      GOOGLE_CLIENT_SECRET: "google-client-secret",
    };

    it("should insert Google config from env when DB row does not exist", async () => {
      // Arrange
      mockServerConfig = googleEnvConfig;
      mockGetConfig.mockResolvedValue(null);
      mockConfigExists.mockResolvedValue(true);
      const { seedServerConfig } = await import("@/server/startup/seed-config");

      // Act
      await seedServerConfig();

      // Assert
      const googleCall = mockSetConfig.mock.calls.find(
        (call) => call[0] === ServerConfigKeys.AUTH_PROVIDER_GOOGLE
      );

      expect(googleCall).toBeDefined();
      expect(googleCall![1]).toMatchObject({
        clientId: "google-client-id",
        clientSecret: "google-client-secret",
        isOverridden: false,
      });
    });

    it("should NOT update Google config when isOverridden=true", async () => {
      // Arrange
      mockServerConfig = googleEnvConfig;
      mockGetConfig.mockImplementation((key: string) => {
        if (key === ServerConfigKeys.AUTH_PROVIDER_GOOGLE) {
          return Promise.resolve({
            clientId: "admin-google-id",
            clientSecret: "admin-google-secret",
            isOverridden: true,
          });
        }

        return Promise.resolve(null);
      });
      mockConfigExists.mockResolvedValue(true);
      const { seedServerConfig } = await import("@/server/startup/seed-config");

      // Act
      await seedServerConfig();

      // Assert
      const googleCall = mockSetConfig.mock.calls.find(
        (call) => call[0] === ServerConfigKeys.AUTH_PROVIDER_GOOGLE
      );

      expect(googleCall).toBeUndefined();
    });
  });

  describe("Admin Override Behavior", () => {
    it("should respect isOverridden flag across multiple restarts", async () => {
      // Arrange - First startup: env config seeded
      mockServerConfig = {
        OIDC_NAME: "OriginalOIDC",
        OIDC_ISSUER: "https://original.example.com",
        OIDC_CLIENT_ID: "original-client-id",
        OIDC_CLIENT_SECRET: "original-secret",
      };
      mockGetConfig.mockResolvedValue(null);
      mockConfigExists.mockResolvedValue(true);
      let { seedServerConfig } = await import("@/server/startup/seed-config");

      // Act - First startup
      await seedServerConfig();

      // Arrange - Second startup: env changed but admin has overridden
      vi.resetModules();
      mockServerConfig = {
        OIDC_NAME: "NewEnvOIDC",
        OIDC_ISSUER: "https://new-env.example.com",
        OIDC_CLIENT_ID: "new-env-client-id",
        OIDC_CLIENT_SECRET: "new-env-secret",
      };
      mockGetConfig.mockImplementation((key: string) => {
        if (key === ServerConfigKeys.AUTH_PROVIDER_OIDC) {
          return Promise.resolve({
            name: "AdminOIDC",
            issuer: "https://admin.example.com",
            clientId: "admin-client-id",
            clientSecret: "admin-secret",
            isOverridden: true,
          });
        }

        return Promise.resolve(null);
      });
      mockSetConfig.mockClear();
      ({ seedServerConfig } = await import("@/server/startup/seed-config"));

      // Act - Second startup
      await seedServerConfig();

      // Assert - OIDC should NOT be updated because isOverridden=true
      const oidcCall = mockSetConfig.mock.calls.find(
        (call) => call[0] === ServerConfigKeys.AUTH_PROVIDER_OIDC
      );

      expect(oidcCall).toBeUndefined();
    });
  });
});
