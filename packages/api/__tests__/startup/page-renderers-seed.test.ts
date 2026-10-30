// @vitest-environment node
/**
 * The Page Renderers setting is seeded once from env (ADR-0019): an upgrader's Obscura vars carry
 * over, a fresh install gets Obscura on, a Chromium endpoint switches the Chromium browser on, and
 * after that the row is the administrator's.
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

  return mockStore.get(ServerConfigKeys.PAGE_RENDERERS);
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

describe("seeding the Page Renderers setting", () => {
  it("ships Obscura on, the Chromium browser and the solver off and private addresses refused", async () => {
    await expect(boot()).resolves.toEqual({
      obscura: { enabled: true, endpoint: "ws://obscura:9222" },
      chromium: { enabled: false, endpoint: "" },
      solver: { enabled: false },
      allowPrivateAddresses: false,
      navigationTimeoutMs: 45000,
    });
  });

  it("carries an upgrader's Obscura endpoint and token over", async () => {
    mockServerConfig.OBSCURA_ENDPOINT = "ws://browser.lan:9333";
    mockServerConfig.OBSCURA_CDP_TOKEN = "upgrader-token";

    await expect(boot()).resolves.toMatchObject({
      obscura: { enabled: true, endpoint: "ws://browser.lan:9333", cdpToken: "upgrader-token" },
    });
  });

  it("seeds the solver, the private-address switch and the timeout from their vars", async () => {
    Object.assign(mockServerConfig, {
      OBSCURA_ENDPOINT: "",
      PAGE_SOLVER_ENABLED: true,
      PAGE_SOLVER_ENDPOINT: "http://flaresolverr:8191/v1",
      ALLOW_PRIVATE_ADDRESSES: true,
      PAGE_RENDERER_TIMEOUT_MS: 60000,
    });

    await expect(boot()).resolves.toEqual({
      obscura: { enabled: false, endpoint: "" },
      chromium: { enabled: false, endpoint: "" },
      solver: { enabled: true, endpoint: "http://flaresolverr:8191/v1" },
      allowPrivateAddresses: true,
      navigationTimeoutMs: 60000,
    });
  });

  it("switches the Chromium browser on at its endpoint, query string and all", async () => {
    mockServerConfig.CHROMIUM_BROWSER_ENDPOINT = "wss://browser.example/cdp?token=abc";

    await expect(boot()).resolves.toMatchObject({
      obscura: { enabled: true, endpoint: "ws://obscura:9222" },
      chromium: { enabled: true, endpoint: "wss://browser.example/cdp?token=abc" },
    });
  });

  it("leaves the row alone once it exists, whatever env says", async () => {
    await boot();
    const seeded = mockStore.get(ServerConfigKeys.PAGE_RENDERERS);

    mockServerConfig.OBSCURA_ENDPOINT = "ws://elsewhere:9222";
    mockServerConfig.CHROMIUM_BROWSER_ENDPOINT = "http://chromium:9222";
    mockServerConfig.PAGE_SOLVER_ENABLED = true;
    mockServerConfig.PAGE_SOLVER_ENDPOINT = "http://byparr:8191/v1";

    await expect(boot()).resolves.toEqual(seeded);
  });
});
