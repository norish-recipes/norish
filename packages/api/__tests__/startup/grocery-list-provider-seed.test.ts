// @vitest-environment node
/**
 * The Shopping List Provider is seeded as the built-in list, once: after that the row is the
 * administrator's (ADR-0041).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServerConfigKeys, validateConfigValue } from "@norish/config/zod/server-config";

const mockStore = new Map<string, unknown>();
let mockServerConfig: Record<string, unknown> = {};

vi.mock("@norish/db/repositories/server-config", () => ({
  getConfig: vi.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
  setConfig: vi.fn((key: string, value: unknown) => {
    const validation = validateConfigValue(key as never, value);

    if (!validation.success) return Promise.reject(validation.error);
    mockStore.set(key, validation.data);

    return Promise.resolve();
  }),
  deleteConfig: vi.fn(),
  configExists: vi.fn((key: string) => Promise.resolve(mockStore.has(key))),
  normalizeAndBackfillConfig: vi.fn(() => Promise.resolve(false)),
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

async function boot(): Promise<unknown> {
  const { seedServerConfig } = await import("@norish/api/startup/seed-config");

  await seedServerConfig();

  return mockStore.get(ServerConfigKeys.GROCERY_LIST_PROVIDER);
}

beforeEach(() => {
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
    OBSCURA_ENDPOINT: "ws://obscura:9222",
    PAGE_SOLVER_ENABLED: false,
    ALLOW_PRIVATE_ADDRESSES: false,
    PAGE_RENDERER_TIMEOUT_MS: 45000,
  };
});

describe("seeding the Shopping List Provider", () => {
  it("ships the built-in grocery list", async () => {
    await expect(boot()).resolves.toBe("builtin");
  });

  it("leaves the administrator's choice alone on the next boot", async () => {
    await boot();
    mockStore.set(ServerConfigKeys.GROCERY_LIST_PROVIDER, "bring");

    await expect(boot()).resolves.toBe("bring");
  });
});
