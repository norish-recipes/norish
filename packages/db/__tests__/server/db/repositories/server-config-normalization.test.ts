// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type {
  AIConfig,
  PageRenderersConfig,
  TimerKeywordsConfig,
} from "@norish/config/zod/server-config";
import { decrypt, encrypt } from "@norish/config/crypto";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import {
  getConfig,
  normalizeAndBackfillConfig,
  setConfig,
} from "@norish/db/repositories/server-config";
import { serverConfig } from "@norish/db/schema";

import { getTestDb } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("server config normalization", () => {
  const testBase = new RepositoryTestBase("server_config_normalization");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();
    await getTestDb().delete(serverConfig);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("backfills missing defaulted fields and strips unknown keys for object configs", async () => {
    const db = getTestDb();

    await db.insert(serverConfig).values({
      key: ServerConfigKeys.TIMER_KEYWORDS,
      value: {
        enabled: false,
        hours: ["hour"],
        minutes: ["minute"],
        seconds: ["second"],
        deprecatedField: true,
      },
      isSensitive: false,
      updatedBy: null,
      updatedAt: new Date(),
      createdAt: new Date(),
    });

    const changed = await normalizeAndBackfillConfig(ServerConfigKeys.TIMER_KEYWORDS);
    const result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);

    expect(changed).toBe(true);
    expect(result).toEqual({
      enabled: false,
      hours: ["hour"],
      minutes: ["minute"],
      seconds: ["second"],
      isOverridden: false,
    });

    const persisted = await db.query.serverConfig.findFirst({
      where: eq(serverConfig.key, ServerConfigKeys.TIMER_KEYWORDS),
    });

    expect(persisted?.value).toEqual(result);
  });

  it("normalizes and persists sensitive configs without overwriting secrets", async () => {
    const db = getTestDb();
    const rawValue = {
      enabled: true,
      provider: "openai",
      model: "gpt-4.1-mini",
      temperature: 0.4,
      maxTokens: 1024,
      apiKey: "secret-key",
      deprecatedField: "remove-me",
    };

    await db.insert(serverConfig).values({
      key: ServerConfigKeys.AI_CONFIG,
      value: {
        ...rawValue,
        apiKey: "••••••••",
      },
      valueEnc: encrypt(JSON.stringify(rawValue)),
      isSensitive: true,
      updatedBy: null,
      updatedAt: new Date(),
      createdAt: new Date(),
    });

    const changed = await normalizeAndBackfillConfig(ServerConfigKeys.AI_CONFIG);
    const result = await getConfig<AIConfig>(ServerConfigKeys.AI_CONFIG, true);

    expect(changed).toBe(true);
    expect(result).toEqual({
      enabled: true,
      provider: "openai",
      model: "gpt-4.1-mini",
      temperature: 0.4,
      maxTokens: 1024,
      timeoutMs: 300000,
      apiKey: "secret-key",
      alwaysUseAI: false,
      tagStrategy: "predefined",
      cuisineStrategy: "existing",
      automaticEnrichment: {
        autoTagging: false,
        allergyDetection: true,
        autoCategorization: false,
        nutritionEstimation: false,
        recipeProvenance: false,
        ingredientLinking: false,
        imageGeneration: false,
      },
      automaticIngredients: { cleanUp: false, nutrition: false, conversions: false, icon: false },
    });

    const persisted = await db.query.serverConfig.findFirst({
      where: eq(serverConfig.key, ServerConfigKeys.AI_CONFIG),
    });

    expect(persisted?.value).toEqual({
      enabled: true,
      provider: "openai",
      model: "gpt-4.1-mini",
      temperature: 0.4,
      maxTokens: 1024,
      timeoutMs: 300000,
      apiKey: "••••••••",
      alwaysUseAI: false,
      tagStrategy: "predefined",
      cuisineStrategy: "existing",
      automaticEnrichment: {
        autoTagging: false,
        allergyDetection: true,
        autoCategorization: false,
        nutritionEstimation: false,
        recipeProvenance: false,
        ingredientLinking: false,
        imageGeneration: false,
      },
      automaticIngredients: { cleanUp: false, nutrition: false, conversions: false, icon: false },
    });
    expect(JSON.parse(decrypt(persisted!.valueEnc!))).toEqual(result);
  });

  it("masks a secret nested in a config and keeps it through a masked save", async () => {
    const renderers: PageRenderersConfig = {
      obscura: { enabled: true, endpoint: "ws://obscura:9222", cdpToken: "cdp-secret" },
      chromium: { enabled: false, endpoint: "" },
      solver: { enabled: false },
      allowPrivateAddresses: false,
      navigationTimeoutMs: 45000,
    };

    await setConfig(ServerConfigKeys.PAGE_RENDERERS, renderers, null, true);

    const masked = await getConfig<PageRenderersConfig>(ServerConfigKeys.PAGE_RENDERERS);

    expect(masked?.obscura.cdpToken).toBe("••••••••");

    await setConfig(
      ServerConfigKeys.PAGE_RENDERERS,
      { ...renderers, obscura: { ...renderers.obscura, cdpToken: "••••••••" } },
      null,
      true
    );

    await expect(
      getConfig<PageRenderersConfig>(ServerConfigKeys.PAGE_RENDERERS, true)
    ).resolves.toEqual(renderers);
  });

  it("backfills a 0.26 beta Page Renderers row with the Chromium browser switched off", async () => {
    // As a 0.26 beta stored it: no Chromium browser yet, the CDP token masked beside its ciphertext.
    const beta = {
      obscura: { enabled: true, endpoint: "ws://obscura:9222", cdpToken: "cdp-secret" },
      solver: { enabled: true, endpoint: "http://flaresolverr:8191/v1" },
      allowPrivateAddresses: false,
      navigationTimeoutMs: 45000,
    };

    await getTestDb()
      .insert(serverConfig)
      .values({
        key: ServerConfigKeys.PAGE_RENDERERS,
        value: { ...beta, obscura: { ...beta.obscura, cdpToken: "••••••••" } },
        valueEnc: encrypt(JSON.stringify(beta)),
        isSensitive: true,
        updatedBy: null,
        updatedAt: new Date(),
        createdAt: new Date(),
      });

    await expect(normalizeAndBackfillConfig(ServerConfigKeys.PAGE_RENDERERS)).resolves.toBe(true);
    await expect(
      getConfig<PageRenderersConfig>(ServerConfigKeys.PAGE_RENDERERS, true)
    ).resolves.toEqual({ ...beta, chromium: { enabled: false, endpoint: "" } });
  });
});
