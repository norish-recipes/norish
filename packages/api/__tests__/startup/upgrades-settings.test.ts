// @vitest-environment node
/** Settings as releases before 0.20 stored them, read into today's shape at boot. */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AIConfigSchema,
  ServerConfigKeys,
  validateConfigValue,
} from "@norish/config/zod/server-config";

const mockStore = new Map<string, unknown>();

vi.mock("@norish/db/repositories/server-config", () => ({
  getConfig: vi.fn((key: string) => Promise.resolve(mockStore.get(key) ?? null)),
  setConfig: vi.fn((key: string, value: unknown) => {
    const validation = validateConfigValue(key as never, value);

    if (!validation.success) return Promise.reject(validation.error);
    mockStore.set(key, validation.data);

    return Promise.resolve();
  }),
}));
vi.mock("@norish/shared-server/logger", () => ({
  serverLogger: { info: vi.fn(), warn: vi.fn() },
}));
vi.mock("@norish/shared-server/ai/prompts/loader", () => ({
  loadDefaultPrompts: () => ({ recipeExtraction: "NEW extraction", autoTagging: "NEW tagging" }),
}));
vi.mock("@norish/api/startup/upgrades/before-0-20-prompt-defaults.json", () => ({
  default: { recipeExtraction: ["OLD extraction"], autoTagging: ["OLD tagging"] },
}));

const { upgradePromptCopies, upgradeTaggingSettings } =
  await import("@norish/api/startup/upgrades/before-0-20-settings");

/** An AI config as 0.19 stored it, around its old tagging fields. */
const stored019 = (fields: Record<string, unknown>) => ({
  enabled: true,
  provider: "openai",
  model: "gpt-5-mini",
  temperature: 1,
  maxTokens: 10000,
  ...fields,
});
const upgraded = () => mockStore.get(ServerConfigKeys.AI_CONFIG) as Record<string, unknown>;

describe("the upgrade of settings from before 0.20", () => {
  beforeEach(() => mockStore.clear());

  it.each([
    ["disabled", false, "predefined"],
    ["predefined_db", true, "predefined_db"],
    ["freeform", true, "freeform"],
  ])(
    "reads the %s tagging mode as auto-tagging %s with that strategy",
    async (mode, on, strategy) => {
      mockStore.set(ServerConfigKeys.AI_CONFIG, stored019({ autoTaggingMode: mode }));

      await upgradeTaggingSettings();

      const config = AIConfigSchema.parse(upgraded());

      expect(config.automaticEnrichment.autoTagging).toBe(on);
      expect(config.tagStrategy).toBe(strategy);
    }
  );

  it("keeps the allergy switch, and a setting already in today's shape wins", async () => {
    mockStore.set(
      ServerConfigKeys.AI_CONFIG,
      stored019({
        autoTaggingMode: "disabled",
        autoTagAllergies: false,
        tagStrategy: "freeform",
        automaticEnrichment: { autoTagging: true },
      })
    );

    await upgradeTaggingSettings();

    const config = AIConfigSchema.parse(upgraded());

    expect(upgraded()).not.toHaveProperty("autoTaggingMode");
    expect(config.automaticEnrichment.allergyDetection).toBe(false);
    expect(config.automaticEnrichment.autoTagging).toBe(true);
    expect(config.tagStrategy).toBe("freeform");
  });

  it("keeps only the prompts an administrator wrote from a row seeded before 0.20", async () => {
    mockStore.set(ServerConfigKeys.PROMPTS, {
      recipeExtraction: "OLD extraction\n",
      autoTagging: "My own tagging",
      isOverridden: true,
    });

    await upgradePromptCopies();

    expect(mockStore.get(ServerConfigKeys.PROMPTS)).toEqual({ autoTagging: "My own tagging" });
  });

  it("leaves a prompts row from 0.20 or later alone, even one holding an old default", async () => {
    const written = { recipeExtraction: "OLD extraction" };

    mockStore.set(ServerConfigKeys.PROMPTS, written);

    await upgradePromptCopies();

    expect(mockStore.get(ServerConfigKeys.PROMPTS)).toBe(written);
  });
});
