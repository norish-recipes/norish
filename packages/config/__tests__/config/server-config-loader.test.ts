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

vi.mock("@norish/api/logger", () => ({
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

    const { isVideoParsingEnabled } = await import("@norish/config/server-config-loader");

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

    const { isVideoParsingEnabled } = await import("@norish/config/server-config-loader");

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

    const { isVideoParsingEnabled } = await import("@norish/config/server-config-loader");

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

    const { isVideoParsingEnabled } = await import("@norish/config/server-config-loader");

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

    const { isVideoParsingEnabled } = await import("@norish/config/server-config-loader");

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

    const { isVideoParsingEnabled } = await import("@norish/config/server-config-loader");

    // Act
    const result = await isVideoParsingEnabled();

    // Assert
    expect(result).toBe(false);
  });

  it("returns false when both configs are null", async () => {
    // Arrange
    mockGetConfig.mockResolvedValue(null);

    const { isVideoParsingEnabled } = await import("@norish/config/server-config-loader");

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

    const { isAIEnabled } = await import("@norish/config/server-config-loader");

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

    const { isAIEnabled } = await import("@norish/config/server-config-loader");

    // Act
    const result = await isAIEnabled();

    // Assert
    expect(result).toBe(false);
  });

  it("returns false when AI config is null", async () => {
    // Arrange
    mockGetConfig.mockResolvedValue(null);

    const { isAIEnabled } = await import("@norish/config/server-config-loader");

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

    const { getUnits } = await import("@norish/config/server-config-loader");
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

    const { getUnits } = await import("@norish/config/server-config-loader");
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

    const { getUnits } = await import("@norish/config/server-config-loader");
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

    const { getUnits } = await import("@norish/config/server-config-loader");
    const result = await getUnits();

    expect(result).toEqual(defaultUnits);
  });
});
