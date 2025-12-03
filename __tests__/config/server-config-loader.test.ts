import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetConfig = vi.fn();

vi.mock("@/server/db/repositories/server-config", () => ({
  getConfig: mockGetConfig,
}));

vi.mock("@/server/logger", () => ({
  serverLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";

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

    const { isVideoParsingEnabled } = await import("@/config/server-config-loader");

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

    const { isVideoParsingEnabled } = await import("@/config/server-config-loader");

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

    const { isVideoParsingEnabled } = await import("@/config/server-config-loader");

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

    const { isVideoParsingEnabled } = await import("@/config/server-config-loader");

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

    const { isVideoParsingEnabled } = await import("@/config/server-config-loader");

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

    const { isVideoParsingEnabled } = await import("@/config/server-config-loader");

    // Act
    const result = await isVideoParsingEnabled();

    // Assert
    expect(result).toBe(false);
  });

  it("returns false when both configs are null", async () => {
    // Arrange
    mockGetConfig.mockResolvedValue(null);

    const { isVideoParsingEnabled } = await import("@/config/server-config-loader");

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

    const { isAIEnabled } = await import("@/config/server-config-loader");

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

    const { isAIEnabled } = await import("@/config/server-config-loader");

    // Act
    const result = await isAIEnabled();

    // Assert
    expect(result).toBe(false);
  });

  it("returns false when AI config is null", async () => {
    // Arrange
    mockGetConfig.mockResolvedValue(null);

    const { isAIEnabled } = await import("@/config/server-config-loader");

    // Act
    const result = await isAIEnabled();

    // Assert
    expect(result).toBe(false);
  });
});
