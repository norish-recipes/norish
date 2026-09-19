/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import defaultUnits from "@norish/config/units.default.json";
import { ServerConfigKeys } from "@norish/config/zod/server-config";

const mockGetConfig = vi.fn();

vi.mock("@norish/db/repositories/server-config", () => ({
  getConfig: mockGetConfig,
}));

vi.mock("@norish/db/logger", () => ({
  serverLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("isVideoParsingEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns true when both AI and video are enabled", async () => {
    // Arrange
    mockGetConfig.mockImplementation((key: string) => {
      if (key === ServerConfigKeys.AI_CONFIG) {
        return Promise.resolve({ enabled: true });
      }
      if (key === ServerConfigKeys.VIDEO_CONFIG) {
        return Promise.resolve({ enabled: true });
      }

      return Promise.resolve(null);
    });

    const { isVideoParsingEnabled } =
      await import("@norish/shared-server/config/server-config-loader");

    // Act
    const result = await isVideoParsingEnabled();

    // Assert
    expect(result).toBe(true);
  });

  it("returns false when AI is enabled but video is disabled", async () => {
    // Arrange
    mockGetConfig.mockImplementation((key: string) => {
      if (key === ServerConfigKeys.AI_CONFIG) {
        return Promise.resolve({ enabled: true });
      }
      if (key === ServerConfigKeys.VIDEO_CONFIG) {
        return Promise.resolve({ enabled: false });
      }

      return Promise.resolve(null);
    });

    const { isVideoParsingEnabled } =
      await import("@norish/shared-server/config/server-config-loader");

    // Act
    const result = await isVideoParsingEnabled();

    // Assert
    expect(result).toBe(false);
  });

  it("returns false when AI is disabled but video is enabled", async () => {
    // Arrange
    mockGetConfig.mockImplementation((key: string) => {
      if (key === ServerConfigKeys.AI_CONFIG) {
        return Promise.resolve({ enabled: false });
      }
      if (key === ServerConfigKeys.VIDEO_CONFIG) {
        return Promise.resolve({ enabled: true });
      }

      return Promise.resolve(null);
    });

    const { isVideoParsingEnabled } =
      await import("@norish/shared-server/config/server-config-loader");

    // Act
    const result = await isVideoParsingEnabled();

    // Assert
    expect(result).toBe(false);
  });

  it("returns false when both AI and video are disabled", async () => {
    // Arrange
    mockGetConfig.mockImplementation((key: string) => {
      if (key === ServerConfigKeys.AI_CONFIG) {
        return Promise.resolve({ enabled: false });
      }
      if (key === ServerConfigKeys.VIDEO_CONFIG) {
        return Promise.resolve({ enabled: false });
      }

      return Promise.resolve(null);
    });

    const { isVideoParsingEnabled } =
      await import("@norish/shared-server/config/server-config-loader");

    // Act
    const result = await isVideoParsingEnabled();

    // Assert
    expect(result).toBe(false);
  });

  it("returns false when AI config is null", async () => {
    // Arrange
    mockGetConfig.mockImplementation((key: string) => {
      if (key === ServerConfigKeys.AI_CONFIG) {
        return Promise.resolve(null);
      }
      if (key === ServerConfigKeys.VIDEO_CONFIG) {
        return Promise.resolve({ enabled: true });
      }

      return Promise.resolve(null);
    });

    const { isVideoParsingEnabled } =
      await import("@norish/shared-server/config/server-config-loader");

    // Act
    const result = await isVideoParsingEnabled();

    // Assert
    expect(result).toBe(false);
  });

  it("returns false when video config is null", async () => {
    // Arrange
    mockGetConfig.mockImplementation((key: string) => {
      if (key === ServerConfigKeys.AI_CONFIG) {
        return Promise.resolve({ enabled: true });
      }
      if (key === ServerConfigKeys.VIDEO_CONFIG) {
        return Promise.resolve(null);
      }

      return Promise.resolve(null);
    });

    const { isVideoParsingEnabled } =
      await import("@norish/shared-server/config/server-config-loader");

    // Act
    const result = await isVideoParsingEnabled();

    // Assert
    expect(result).toBe(false);
  });

  it("returns false when both configs are null", async () => {
    // Arrange
    mockGetConfig.mockResolvedValue(null);

    const { isVideoParsingEnabled } =
      await import("@norish/shared-server/config/server-config-loader");

    // Act
    const result = await isVideoParsingEnabled();

    // Assert
    expect(result).toBe(false);
  });
});

describe("isAIEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns true when AI is enabled", async () => {
    // Arrange
    mockGetConfig.mockImplementation((key: string) => {
      if (key === ServerConfigKeys.AI_CONFIG) {
        return Promise.resolve({ enabled: true });
      }

      return Promise.resolve(null);
    });

    const { isAIEnabled } = await import("@norish/shared-server/config/server-config-loader");

    // Act
    const result = await isAIEnabled();

    // Assert
    expect(result).toBe(true);
  });

  it("returns false when AI is disabled", async () => {
    // Arrange
    mockGetConfig.mockImplementation((key: string) => {
      if (key === ServerConfigKeys.AI_CONFIG) {
        return Promise.resolve({ enabled: false });
      }

      return Promise.resolve(null);
    });

    const { isAIEnabled } = await import("@norish/shared-server/config/server-config-loader");

    // Act
    const result = await isAIEnabled();

    // Assert
    expect(result).toBe(false);
  });

  it("returns false when AI config is null", async () => {
    // Arrange
    mockGetConfig.mockResolvedValue(null);

    const { isAIEnabled } = await import("@norish/shared-server/config/server-config-loader");

    // Act
    const result = await isAIEnabled();

    // Assert
    expect(result).toBe(false);
  });
});

describe("getUnits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns wrapped units from config", async () => {
    mockGetConfig.mockResolvedValue({
      units: {
        cup: {
          short: [{ locale: "en", name: "cup" }],
          plural: [{ locale: "en", name: "cups" }],
          alternates: ["cups"],
        },
      },
      isOverridden: true,
    });

    const { getUnits } = await import("@norish/shared-server/config/server-config-loader");
    const result = await getUnits();

    expect(result).toEqual({
      cup: {
        short: [{ locale: "en", name: "cup" }],
        plural: [{ locale: "en", name: "cups" }],
        alternates: ["cups"],
      },
    });
  });

  it("returns legacy flat units map from config", async () => {
    mockGetConfig.mockResolvedValue({
      cup: {
        short: [{ locale: "en", name: "cup" }],
        plural: [{ locale: "en", name: "cups" }],
        alternates: ["cups"],
      },
    });

    const { getUnits } = await import("@norish/shared-server/config/server-config-loader");
    const result = await getUnits();

    expect(result).toEqual({
      cup: {
        short: [{ locale: "en", name: "cup" }],
        plural: [{ locale: "en", name: "cups" }],
        alternates: ["cups"],
      },
    });
  });

  it("returns legacy wrapped units map from config", async () => {
    mockGetConfig.mockResolvedValue({
      units: {
        cup: {
          short: [{ locale: "en", name: "cup" }],
          plural: [{ locale: "en", name: "cups" }],
          alternates: ["cups"],
        },
      },
      isOverwritten: true,
    });

    const { getUnits } = await import("@norish/shared-server/config/server-config-loader");
    const result = await getUnits();

    expect(result).toEqual({
      cup: {
        short: [{ locale: "en", name: "cup" }],
        plural: [{ locale: "en", name: "cups" }],
        alternates: ["cups"],
      },
    });
  });

  it("falls back to default units when config is missing", async () => {
    mockGetConfig.mockResolvedValue(null);

    const { getUnits } = await import("@norish/shared-server/config/server-config-loader");
    const result = await getUnits();

    expect(result).toEqual(defaultUnits);
  });
});

describe("the Decision Model block (ADR-0035)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  function stored(values: Record<string, unknown>) {
    mockGetConfig.mockImplementation((key: string) => Promise.resolve(values[key] ?? null));
  }

  it("getDecisionConfig returns null on a fresh server", async () => {
    stored({});

    const { getDecisionConfig } = await import("@norish/shared-server/config/server-config-loader");

    expect(await getDecisionConfig()).toBeNull();
  });

  it("getDecisionConfig returns the parsed block after a save", async () => {
    stored({
      [ServerConfigKeys.DECISION_CONFIG]: { provider: "typesafe", apiKey: "k", model: "jev-latest" },
    });

    const { getDecisionConfig } = await import("@norish/shared-server/config/server-config-loader");

    expect(await getDecisionConfig(true)).toEqual({
      provider: "typesafe",
      apiKey: "k",
      model: "jev-latest",
    });
  });

  it("getDecisionConfig treats a row that no longer matches the contract as absent", async () => {
    stored({ [ServerConfigKeys.DECISION_CONFIG]: { provider: "openai" } });

    const { getDecisionConfig } = await import("@norish/shared-server/config/server-config-loader");

    expect(await getDecisionConfig()).toBeNull();
  });

  it("isDecisionModelConfigured is false until a key is stored with a real provider", async () => {
    const { isDecisionModelConfigured } =
      await import("@norish/shared-server/config/server-config-loader");

    stored({});
    expect(await isDecisionModelConfigured()).toBe(false);

    stored({ [ServerConfigKeys.DECISION_CONFIG]: { provider: "typesafe" } });
    expect(await isDecisionModelConfigured()).toBe(false);

    stored({ [ServerConfigKeys.DECISION_CONFIG]: { provider: "disabled", apiKey: "k" } });
    expect(await isDecisionModelConfigured()).toBe(false);

    stored({ [ServerConfigKeys.DECISION_CONFIG]: { provider: "typesafe", apiKey: "k" } });
    expect(await isDecisionModelConfigured()).toBe(true);
  });

  describe("isDecisionUseEnabled", () => {
    const aiOn = { enabled: true, provider: "openai", model: "m", temperature: 1, maxTokens: 1 };

    it("is false for every use when no Decision Model is configured", async () => {
      stored({ [ServerConfigKeys.AI_CONFIG]: aiOn });

      const { isDecisionUseEnabled } =
        await import("@norish/shared-server/config/server-config-loader");

      expect(await isDecisionUseEnabled("autoCategorization")).toBe(false);
      expect(await isDecisionUseEnabled("validateEnrichments")).toBe(false);
    });

    it("is true for every use by default once one is", async () => {
      stored({
        [ServerConfigKeys.AI_CONFIG]: aiOn,
        [ServerConfigKeys.DECISION_CONFIG]: { provider: "typesafe", apiKey: "k" },
      });

      const { isDecisionUseEnabled } =
        await import("@norish/shared-server/config/server-config-loader");

      expect(await isDecisionUseEnabled("autoCategorization")).toBe(true);
      expect(await isDecisionUseEnabled("groceryLinking")).toBe(true);
    });

    it("follows the stored selection after a save", async () => {
      stored({
        [ServerConfigKeys.AI_CONFIG]: aiOn,
        [ServerConfigKeys.DECISION_CONFIG]: {
          provider: "typesafe",
          apiKey: "k",
          uses: ["allergyDetection"],
        },
      });

      const { isDecisionUseEnabled } =
        await import("@norish/shared-server/config/server-config-loader");

      expect(await isDecisionUseEnabled("allergyDetection")).toBe(true);
      expect(await isDecisionUseEnabled("autoCategorization")).toBe(false);
    });

    it("is false for every use while AI is globally off", async () => {
      // "AI off" means no request leaves the server, Decisions included.
      stored({
        [ServerConfigKeys.AI_CONFIG]: { ...aiOn, enabled: false },
        [ServerConfigKeys.DECISION_CONFIG]: { provider: "typesafe", apiKey: "k" },
      });

      const { isDecisionUseEnabled } =
        await import("@norish/shared-server/config/server-config-loader");

      expect(await isDecisionUseEnabled("allergyDetection")).toBe(false);
    });
  });
});
