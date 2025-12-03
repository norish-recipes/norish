import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";

// Mock dependencies
const mockGetConfig = vi.fn();
const mockSetConfig = vi.fn();
const mockConfigExists = vi.fn();

vi.mock("@/server/db/repositories/server-config", () => ({
  getConfig: mockGetConfig,
  setConfig: mockSetConfig,
  configExists: mockConfigExists,
}));

vi.mock("@/server/logger", () => ({
  serverLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
  authLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
  trpcLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("Password Authentication Configuration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("ServerConfigKeys", () => {
    it("should have PASSWORD_AUTH_ENABLED key defined", () => {
      expect(ServerConfigKeys.PASSWORD_AUTH_ENABLED).toBe("password_auth_enabled");
    });
  });

  describe("getAvailableProviders", () => {
    it("should include credential provider when password auth is enabled", async () => {
      // Arrange
      mockGetConfig.mockImplementation((key: string) => {
        if (key === ServerConfigKeys.PASSWORD_AUTH_ENABLED) {
          return Promise.resolve(true);
        }

        return Promise.resolve(null);
      });

      const { getAvailableProviders } = await import("@/server/auth/providers");

      // Act
      const providers = await getAvailableProviders();

      // Assert
      const credentialProvider = providers.find((p) => p.id === "credential");

      expect(credentialProvider).toBeDefined();
      expect(credentialProvider?.type).toBe("credential");
      expect(credentialProvider?.name).toBe("Email");
    });

    it("should not include credential provider when password auth is disabled", async () => {
      // Arrange
      mockGetConfig.mockImplementation((key: string) => {
        if (key === ServerConfigKeys.PASSWORD_AUTH_ENABLED) {
          return Promise.resolve(false);
        }

        return Promise.resolve(null);
      });

      const { getAvailableProviders } = await import("@/server/auth/providers");

      // Act
      const providers = await getAvailableProviders();

      // Assert
      const credentialProvider = providers.find((p) => p.id === "credential");

      expect(credentialProvider).toBeUndefined();
    });

    it("should include both credential and OAuth providers when both are enabled", async () => {
      // Arrange
      mockGetConfig.mockImplementation((key: string, _includeSecrets?: boolean) => {
        if (key === ServerConfigKeys.PASSWORD_AUTH_ENABLED) {
          return Promise.resolve(true);
        }
        if (key === ServerConfigKeys.AUTH_PROVIDER_GITHUB) {
          return Promise.resolve({ clientId: "github-client-id", clientSecret: "secret" });
        }

        return Promise.resolve(null);
      });

      const { getAvailableProviders } = await import("@/server/auth/providers");

      // Act
      const providers = await getAvailableProviders();

      // Assert
      expect(providers).toHaveLength(2);
      expect(providers.find((p) => p.id === "credential")).toBeDefined();
      expect(providers.find((p) => p.id === "github")).toBeDefined();
    });
  });

  describe("isPasswordAuthEnabled", () => {
    it("should return true when password auth is enabled", async () => {
      // Arrange
      mockGetConfig.mockResolvedValue(true);

      const { isPasswordAuthEnabled } = await import("@/server/auth/providers");

      // Act
      const result = await isPasswordAuthEnabled();

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when password auth is disabled", async () => {
      // Arrange
      mockGetConfig.mockResolvedValue(false);

      const { isPasswordAuthEnabled } = await import("@/server/auth/providers");

      // Act
      const result = await isPasswordAuthEnabled();

      // Assert
      expect(result).toBe(false);
    });

    it("should return false when config is null", async () => {
      // Arrange
      mockGetConfig.mockResolvedValue(null);

      const { isPasswordAuthEnabled } = await import("@/server/auth/providers");

      // Act
      const result = await isPasswordAuthEnabled();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("getConfiguredProviders", () => {
    it("should return password: true when password auth is enabled", async () => {
      // Arrange
      mockGetConfig.mockImplementation((key: string) => {
        if (key === ServerConfigKeys.PASSWORD_AUTH_ENABLED) {
          return Promise.resolve(true);
        }

        return Promise.resolve(null);
      });

      const { getConfiguredProviders } = await import("@/server/auth/providers");

      // Act
      const result = await getConfiguredProviders();

      // Assert
      expect(result.password).toBe(true);
    });

    it("should return password: false when password auth is disabled", async () => {
      // Arrange
      mockGetConfig.mockImplementation((key: string) => {
        if (key === ServerConfigKeys.PASSWORD_AUTH_ENABLED) {
          return Promise.resolve(false);
        }

        return Promise.resolve(null);
      });

      const { getConfiguredProviders } = await import("@/server/auth/providers");

      // Act
      const result = await getConfiguredProviders();

      // Assert
      expect(result.password).toBe(false);
    });
  });
});
