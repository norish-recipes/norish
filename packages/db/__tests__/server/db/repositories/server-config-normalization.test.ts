// @vitest-environment node

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { AIConfig, TimerKeywordsConfig } from "@norish/config/zod/server-config";
import { decrypt, encrypt } from "@norish/auth/crypto";
import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { getConfig, normalizeAndBackfillConfig } from "@norish/db/repositories/server-config";
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
      apiKey: "secret-key",
      autoTagAllergies: true,
      alwaysUseAI: false,
      autoTaggingMode: "disabled",
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
      apiKey: "••••••••",
      autoTagAllergies: true,
      alwaysUseAI: false,
      autoTaggingMode: "disabled",
    });
    expect(JSON.parse(decrypt(persisted!.valueEnc!))).toEqual(result);
  });
});
