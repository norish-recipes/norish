// @vitest-environment node
/**
 * Unit-vocabulary propagation across upgrades.
 *
 * The units row is seeded at first boot, so every existing deployment holds a
 * frozen copy of whatever units.default.json looked like then. Adding locales
 * to the shipped file therefore reaches nobody until boot carries them in
 * (#504) — while a vocabulary an administrator edited is theirs, and stays.
 *
 * Runs the real `seedServerConfig` against an in-memory config store, planting
 * rows exactly as previous releases wrote them.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServerConfigKeys, validateConfigValue } from "@norish/config/zod/server-config";

/** What the upgraded release ships on disk: one unit, now with Spanish. */
const SHIPPED = {
  liter: {
    short: [
      { locale: "en", name: "l" },
      { locale: "es", name: "l" },
    ],
    plural: [
      { locale: "en", name: "liters" },
      { locale: "es", name: "litros" },
    ],
    alternates: ["liter", "liters", "litro", "litros"],
  },
};

/** What the previous release seeded: the same unit, English only. */
const SEEDED = {
  liter: {
    short: [{ locale: "en", name: "l" }],
    plural: [{ locale: "en", name: "liters" }],
    alternates: ["liter", "liters"],
  },
};

const mockStore = new Map<string, unknown>();
const mockGetConfig = vi.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null));
const mockSetConfig = vi.fn((key: string, value: unknown) => {
  const validation = validateConfigValue(key as never, value);

  if (!validation.success) {
    return Promise.reject(
      new Error(`Invalid config value for ${key}: ${validation.error.message}`)
    );
  }

  mockStore.set(key, validation.data);

  return Promise.resolve();
});
const mockDeleteConfig = vi.fn((key: string) => {
  mockStore.delete(key);

  return Promise.resolve();
});
const mockConfigExists = vi.fn((key: string) => Promise.resolve(mockStore.has(key)));
const mockNormalizeAndBackfillConfig = vi.fn(() => Promise.resolve(false));
let mockServerConfig: Record<string, unknown> = {};

vi.mock("@norish/db/repositories/server-config", () => ({
  getConfig: mockGetConfig,
  setConfig: mockSetConfig,
  deleteConfig: mockDeleteConfig,
  configExists: mockConfigExists,
  normalizeAndBackfillConfig: mockNormalizeAndBackfillConfig,
}));

vi.mock("@norish/auth/provider-cache", () => ({ setAuthProviderCache: vi.fn() }));

vi.mock("@norish/shared-server/logger", () => ({
  serverLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@norish/config/env-config-server", () => ({
  get SERVER_CONFIG() {
    return mockServerConfig;
  },
}));

vi.mock("@norish/config/units.default.json", () => ({ default: SHIPPED }));
vi.mock("@norish/config/content-indicators.default.json", () => ({
  default: { schemaIndicators: [], contentIndicators: [] },
}));
vi.mock("@norish/config/recurrence-config.default.json", () => ({ default: { locales: {} } }));

vi.mock("@norish/shared-server/ai/prompts/loader", () => ({
  loadDefaultPrompts: vi.fn(() => ({})),
  loadRetiredDefaultPrompts: vi.fn(() => ({})),
}));

async function bootOnce(): Promise<void> {
  const { seedServerConfig } = await import("@norish/api/startup/seed-config");

  await seedServerConfig();
}

/** The vocabulary the server would serve after boot. */
function storedUnits(): { units: unknown; isOverridden: boolean } {
  return mockStore.get(ServerConfigKeys.UNITS) as { units: unknown; isOverridden: boolean };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mockStore.clear();
  mockServerConfig = {
    ENABLED_LOCALES: [],
    SCHEDULER_CLEANUP_MONTHS: 3,
    MAX_VIDEO_FILE_SIZE: 100,
    AI_ENABLED: false,
    AI_PROVIDER: "openai",
    AI_MODEL: "gpt-5-mini",
    AI_TEMPERATURE: 1,
    AI_MAX_TOKENS: 10000,
    AI_TIMEOUT_MS: 300000,
    VIDEO_PARSING_ENABLED: false,
    VIDEO_MAX_LENGTH_SECONDS: 120,
    TRANSCRIPTION_PROVIDER: "disabled",
    TRANSCRIPTION_MODEL: "whisper-1",
  };

  // Rows every boot walks past, stored as a healthy deployment has them, so
  // the units row is the only variable.
  mockStore.set(ServerConfigKeys.REGISTRATION_ENABLED, true);
  mockStore.set(ServerConfigKeys.PASSWORD_AUTH_ENABLED, true);
  mockStore.set(ServerConfigKeys.CONTENT_INDICATORS, {
    schemaIndicators: [],
    contentIndicators: [],
  });
  mockStore.set(ServerConfigKeys.RECURRENCE_CONFIG, { locales: {} });
  mockStore.set(ServerConfigKeys.SCHEDULER_CLEANUP_MONTHS, 3);
  mockStore.set(ServerConfigKeys.JOB_RETENTION, {
    keepCompleted: 100,
    keepFailed: 500,
    maxAgeDays: 7,
  });
  mockStore.set(ServerConfigKeys.AI_CONFIG, {
    enabled: false,
    provider: "openai",
    model: "gpt-5-mini",
    temperature: 1,
    maxTokens: 10000,
  });
  mockStore.set(ServerConfigKeys.VIDEO_CONFIG, {
    enabled: false,
    maxLengthSeconds: 120,
    maxVideoFileSize: 100,
    transcriptionProvider: "disabled",
    transcriptionModel: "whisper-1",
  });
  mockStore.set(ServerConfigKeys.RECIPE_PERMISSION_POLICY, {
    defaultVisibility: "household",
    allowPublicSharing: true,
  });
  mockStore.set(ServerConfigKeys.LOCALE_CONFIG, {
    defaultLocale: "en",
    locales: { en: { name: "English", enabled: true } },
  });
  mockStore.set(ServerConfigKeys.TIMER_KEYWORDS, {
    enabled: true,
    hours: ["hour"],
    minutes: ["minute"],
    seconds: ["second"],
    isOverridden: true,
  });
});

describe("upgrading a deployment that never edited its units", () => {
  it("carries the shipped vocabulary in, locales and all", async () => {
    mockStore.set(ServerConfigKeys.UNITS, { units: SEEDED, isOverridden: false });

    await bootOnce();

    expect(storedUnits().units).toEqual(SHIPPED);
    expect(storedUnits().isOverridden).toBe(false);
  });

  it("leaves a row that already matches the file alone", async () => {
    mockStore.set(ServerConfigKeys.UNITS, { units: SHIPPED, isOverridden: false });

    await bootOnce();

    expect(
      mockSetConfig.mock.calls.some(([key]) => key === ServerConfigKeys.UNITS),
      "rewrote an already-current units row"
    ).toBe(false);
  });
});

describe("a vocabulary the administrator edited", () => {
  it("survives the upgrade untouched", async () => {
    mockStore.set(ServerConfigKeys.UNITS, { units: SEEDED, isOverridden: true });

    await bootOnce();

    expect(storedUnits().units).toEqual(SEEDED);
    expect(storedUnits().isOverridden).toBe(true);
  });
});

describe("a fresh install", () => {
  it("is seeded with the shipped vocabulary", async () => {
    await bootOnce();

    expect(storedUnits().units).toEqual(SHIPPED);
  });
});
