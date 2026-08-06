// @vitest-environment node
/**
 * Prompt-default propagation across upgrades.
 *
 * The admin UI and every AI feature read each prompt as: the stored override
 * when one exists and is non-blank, otherwise the shipped default. For that
 * view to stay fresh across releases, boot must never leave a stored copy of
 * a shipped default (current or from any previous release) pinned in the
 * database — while a genuinely customized prompt survives every boot.
 *
 * These tests run the real `seedServerConfig` against an in-memory config
 * store, planting rows exactly as previous releases wrote them.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ServerConfigKeys, validateConfigValue } from "@norish/config/zod/server-config";

/** What the upgraded release ships on disk. */
const NEW_DEFAULTS = {
  recipeExtraction: "NEW recipe extraction instructions",
  imageExtraction: "NEW image extraction instructions",
  unitConversion: "NEW unit conversion instructions",
  nutritionEstimation: "NEW nutrition estimation instructions",
  autoTagging: "NEW auto tagging instructions",
  autoCategorization: "NEW auto categorization instructions",
  allergyDetection: "NEW allergy detection instructions",
  recipeProvenance: "NEW recipe provenance instructions",
  ingredientLinking: "NEW ingredient linking instructions",
};

/** What older releases shipped (and seeded into deployments' databases). */
const OLD = {
  recipeExtraction: "OLD recipe extraction instructions",
  unitConversion: "OLD unit conversion instructions",
  nutritionEstimation: "OLD nutrition estimation instructions",
  autoTagging: "OLD auto tagging instructions",
};

const HISTORICAL = {
  recipeExtraction: [OLD.recipeExtraction],
  unitConversion: [OLD.unitConversion],
  nutritionEstimation: [OLD.nutritionEstimation],
  autoTagging: [OLD.autoTagging],
};

const PROMPT_KEYS = Object.keys(NEW_DEFAULTS) as (keyof typeof NEW_DEFAULTS)[];

// In-memory server_config store. setConfig enforces the same schema the real
// repository does, so a write the production database would reject fails here.
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

vi.mock("@norish/auth/provider-cache", () => ({
  setAuthProviderCache: vi.fn(),
}));

vi.mock("@norish/shared-server/logger", () => ({
  serverLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@norish/config/env-config-server", () => ({
  get SERVER_CONFIG() {
    return mockServerConfig;
  },
}));

vi.mock("@norish/config/units.default.json", () => ({ default: {} }));
vi.mock("@norish/config/content-indicators.default.json", () => ({
  default: { schemaIndicators: [], contentIndicators: [] },
}));
vi.mock("@norish/config/recurrence-config.default.json", () => ({
  default: { locales: {} },
}));

vi.mock("@norish/shared-server/ai/prompts/loader", () => ({
  loadDefaultPrompts: vi.fn(() => ({ ...NEW_DEFAULTS })),
  loadRetiredDefaultPrompts: vi.fn(() => HISTORICAL),
}));

/**
 * The prompt a feature sends and the admin UI shows: the stored override when
 * present and non-blank, the shipped default otherwise. Mirrors `loadPrompt`.
 */
function effectivePrompt(field: keyof typeof NEW_DEFAULTS): string {
  const stored = mockStore.get(ServerConfigKeys.PROMPTS) as Record<string, unknown> | undefined;
  const value = stored?.[field];

  return typeof value === "string" && value.trim() !== "" ? value : NEW_DEFAULTS[field];
}

/** Every stored prompt text still pinned in the row, by field. */
function pinnedPrompts(): Record<string, string> {
  const stored = (mockStore.get(ServerConfigKeys.PROMPTS) ?? {}) as Record<string, unknown>;
  const pinned: Record<string, string> = {};

  for (const field of PROMPT_KEYS) {
    const value = stored[field];

    if (typeof value === "string" && value.trim() !== "") {
      pinned[field] = value;
    }
  }

  return pinned;
}

async function bootOnce(): Promise<void> {
  const { seedServerConfig } = await import("@norish/api/startup/seed-config");

  await seedServerConfig();
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

  // Rows every boot walks past, stored exactly as a healthy deployment has
  // them, so the prompts scenarios are the only variable.
  mockStore.set(ServerConfigKeys.REGISTRATION_ENABLED, true);
  mockStore.set(ServerConfigKeys.PASSWORD_AUTH_ENABLED, true);
  mockStore.set(ServerConfigKeys.UNITS, { units: {}, isOverridden: false });
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

describe("a fresh install", () => {
  it("serves the shipped defaults without pinning a copy of them", async () => {
    await bootOnce();

    for (const field of PROMPT_KEYS) {
      expect(effectivePrompt(field), field).toBe(NEW_DEFAULTS[field]);
    }

    // A pinned copy is what goes stale at the next release.
    expect(pinnedPrompts()).toEqual({});
  });
});

describe("upgrading a deployment that never touched its prompts", () => {
  it("releases the previous release's seeded texts (isOverridden=false row)", async () => {
    mockStore.set(ServerConfigKeys.PROMPTS, { ...OLD, isOverridden: false });

    await bootOnce();

    for (const field of PROMPT_KEYS) {
      expect(effectivePrompt(field), field).toBe(NEW_DEFAULTS[field]);
    }

    expect(pinnedPrompts()).toEqual({});
  });

  it("releases old defaults frozen by a save that never changed them (isOverridden=true row)", async () => {
    // The admin opened the prompts form once and saved; every text is still
    // exactly what some previous release shipped.
    mockStore.set(ServerConfigKeys.PROMPTS, { ...OLD, isOverridden: true });

    await bootOnce();

    for (const field of PROMPT_KEYS) {
      expect(effectivePrompt(field), field).toBe(NEW_DEFAULTS[field]);
    }

    expect(pinnedPrompts()).toEqual({});
  });
});

describe("upgrading a deployment with a genuinely customized prompt", () => {
  it("keeps the customized prompt and refreshes every other one", async () => {
    const custom = "Never mention tomatoes. Ever.";

    mockStore.set(ServerConfigKeys.PROMPTS, {
      ...OLD,
      recipeExtraction: custom,
      isOverridden: true,
    });

    await bootOnce();

    expect(effectivePrompt("recipeExtraction")).toBe(custom);

    for (const field of PROMPT_KEYS.filter((key) => key !== "recipeExtraction")) {
      expect(effectivePrompt(field), field).toBe(NEW_DEFAULTS[field]);
    }

    expect(pinnedPrompts()).toEqual({ recipeExtraction: custom });
  });

  it("releases a customization the new release adopted as its default", async () => {
    // The admin's text is literally what the new release now ships: it is no
    // longer an override, and keeping it pinned would freeze the field again.
    mockStore.set(ServerConfigKeys.PROMPTS, {
      ...OLD,
      autoTagging: NEW_DEFAULTS.autoTagging,
      isOverridden: true,
    });

    await bootOnce();

    for (const field of PROMPT_KEYS) {
      expect(effectivePrompt(field), field).toBe(NEW_DEFAULTS[field]);
    }

    expect(pinnedPrompts()).toEqual({});
  });
});

describe("booting a deployment already in the overrides-only shape", () => {
  it("changes nothing: the boot is idempotent and the override survives", async () => {
    const custom = "Extract in the style of a 1950s cookbook.";

    mockStore.set(ServerConfigKeys.PROMPTS, { recipeExtraction: custom });

    await bootOnce();

    expect(effectivePrompt("recipeExtraction")).toBe(custom);
    expect(pinnedPrompts()).toEqual({ recipeExtraction: custom });

    const promptWrites = mockSetConfig.mock.calls.filter(
      (call) => call[0] === ServerConfigKeys.PROMPTS
    );

    expect(promptWrites).toEqual([]);
  });
});
