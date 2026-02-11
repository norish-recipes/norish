// @vitest-environment node
/**
 * Timer Keywords Configuration - DB Integration Tests
 *
 * Tests the complete seeding and override behavior for timer keywords:
 * 1. Initial seeding from default config file
 * 2. Re-seeding when config file changes (only if not overridden)
 * 3. User override prevents automatic updates
 * 4. Reset to defaults functionality
 * 5. Enable/disable toggle
 */

import type { TimerKeywordsConfig } from "@/server/db/zodSchemas/server-config";

import fs from "fs";
import path from "path";

import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { RepositoryTestBase } from "@/__tests__/helpers/repository-test-base";
import { getConfig, setConfig, deleteConfig } from "@/server/db/repositories/server-config";
import { ServerConfigKeys } from "@/server/db/zodSchemas/server-config";
import { seedDefaultTimerKeywords } from "@/server/startup/seed-config";

describe("Timer Keywords Configuration - Seeding & Override Behavior", () => {
  let testUserId: string;
  const testBase = new RepositoryTestBase("timer_keywords_seeding");

  // Default config from file
  const DEFAULT_KEYWORDS = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "config/timer-keywords.default.json"), "utf-8")
  );

  beforeAll(async () => {
    await testBase.setup();
    const [user] = await testBase.beforeEachTest();

    testUserId = user.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  describe("1. Initial Seeding", () => {
    it("should seed timer keywords from default config file on first run", async () => {
      // Verify no config exists
      let result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);

      expect(result).toBeNull();

      // Run seeding
      await seedDefaultTimerKeywords();

      // Verify config was seeded from file
      result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);

      expect(result).toBeDefined();
      expect(result?.enabled).toBe(DEFAULT_KEYWORDS.enabled);
      expect(result?.hours).toEqual(DEFAULT_KEYWORDS.hours);
      expect(result?.minutes).toEqual(DEFAULT_KEYWORDS.minutes);
      expect(result?.seconds).toEqual(DEFAULT_KEYWORDS.seconds);
      expect(result?.isOverridden).toBe(false);
    });

    it("should include all multilingual keywords from default file", async () => {
      await deleteConfig(ServerConfigKeys.TIMER_KEYWORDS);

      await seedDefaultTimerKeywords();

      const result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);

      // Verify English keywords
      expect(result?.minutes).toContain("minute");
      expect(result?.hours).toContain("hour");

      // Verify German keywords
      expect(result?.minutes).toContain("minuten");
      expect(result?.hours).toContain("stunde");

      // Verify French keywords
      expect(result?.hours).toContain("heure");

      // Verify Dutch keywords
      expect(result?.hours).toContain("uur");
    });
  });

  describe("2. Re-seeding When Config File Changes (isOverridden=false)", () => {
    it("should update keywords when file changes and isOverridden is false", async () => {
      // Initial seed
      await deleteConfig(ServerConfigKeys.TIMER_KEYWORDS);
      await seedDefaultTimerKeywords();

      let result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);

      expect(result?.isOverridden).toBe(false);
      const originalMinutes = result?.minutes;

      // Simulate config file update by manually setting new keywords with isOverridden=false
      const updatedConfig: TimerKeywordsConfig = {
        enabled: true,
        hours: result?.hours || [],
        minutes: [...(originalMinutes || []), "minuto", "minutos"], // Added Spanish
        seconds: result?.seconds || [],
        isOverridden: false, // Still using defaults
      };

      await setConfig(ServerConfigKeys.TIMER_KEYWORDS, updatedConfig, testUserId, false);

      // Verify update was applied
      result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);
      expect(result?.minutes).toContain("minuto");
      expect(result?.isOverridden).toBe(false);
    });

    it("should NOT re-seed if config already exists with isOverridden=false (idempotent)", async () => {
      await deleteConfig(ServerConfigKeys.TIMER_KEYWORDS);

      // First seed
      await seedDefaultTimerKeywords();
      const firstResult = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);

      // Second seed (should be idempotent)
      await seedDefaultTimerKeywords();
      const secondResult = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);

      expect(secondResult).toEqual(firstResult);
    });
  });

  describe("3. User Override Prevents Automatic Updates", () => {
    it("should NOT update keywords when user has overridden (isOverridden=true)", async () => {
      // User customizes keywords
      const userCustomConfig: TimerKeywordsConfig = {
        enabled: true,
        hours: ["saat"],
        minutes: ["dakika"], // Turkish only
        seconds: ["saniye"],
        isOverridden: true,
      };

      await setConfig(ServerConfigKeys.TIMER_KEYWORDS, userCustomConfig, testUserId, false);

      // Verify user config is saved
      let result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);

      expect(result?.minutes).toEqual(["dakika"]);
      expect(result?.isOverridden).toBe(true);

      // Attempt to seed (should skip because isOverridden=true)
      await seedDefaultTimerKeywords();

      // Verify user config is UNCHANGED
      result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);
      expect(result?.minutes).toEqual(["dakika"]);
      expect(result?.isOverridden).toBe(true);
      expect(result?.minutes).not.toContain("minute"); // Defaults not applied
    });

    it("should preserve custom keywords even with multiple seed attempts", async () => {
      const customConfig: TimerKeywordsConfig = {
        enabled: true,
        hours: ["custom_h"],
        minutes: ["custom_m"],
        seconds: ["custom_s"],
        isOverridden: true,
      };

      await setConfig(ServerConfigKeys.TIMER_KEYWORDS, customConfig, testUserId, false);

      // Multiple seed attempts
      await seedDefaultTimerKeywords();
      await seedDefaultTimerKeywords();
      await seedDefaultTimerKeywords();

      // Verify still custom
      const result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);

      expect(result?.hours).toEqual(["custom_h"]);
      expect(result?.minutes).toEqual(["custom_m"]);
      expect(result?.seconds).toEqual(["custom_s"]);
      expect(result?.isOverridden).toBe(true);
    });
  });

  describe("4. isOverridden Flag Management", () => {
    it("should set isOverridden to true when admin saves via UI", async () => {
      // Start with defaults
      await deleteConfig(ServerConfigKeys.TIMER_KEYWORDS);
      await seedDefaultTimerKeywords();

      let result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);

      expect(result?.isOverridden).toBe(false);

      // Admin saves custom config via UI (simulating admin mutation)
      const adminCustomConfig: TimerKeywordsConfig = {
        enabled: true,
        hours: ["admin_hour"],
        minutes: ["admin_min"],
        seconds: ["admin_sec"],
        isOverridden: true, // Set by admin mutation
      };

      await setConfig(ServerConfigKeys.TIMER_KEYWORDS, adminCustomConfig, testUserId, false);

      result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);
      expect(result?.isOverridden).toBe(true);
      expect(result?.minutes).toEqual(["admin_min"]);
    });
  });

  describe("5. Reset to Defaults", () => {
    it("should reset to defaults by deleting config (allows re-seeding)", async () => {
      // User has custom config
      const customConfig: TimerKeywordsConfig = {
        enabled: true,
        hours: ["custom_h"],
        minutes: ["custom_m"],
        seconds: ["custom_s"],
        isOverridden: true,
      };

      await setConfig(ServerConfigKeys.TIMER_KEYWORDS, customConfig, testUserId, false);

      // Admin clicks "Reset to Defaults" - deletes the config
      await deleteConfig(ServerConfigKeys.TIMER_KEYWORDS);

      // Verify deleted
      let result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);

      expect(result).toBeNull();

      // Re-seed to restore defaults
      await seedDefaultTimerKeywords();

      // Verify defaults restored
      result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);
      expect(result?.hours).toEqual(DEFAULT_KEYWORDS.hours);
      expect(result?.minutes).toEqual(DEFAULT_KEYWORDS.minutes);
      expect(result?.seconds).toEqual(DEFAULT_KEYWORDS.seconds);
      expect(result?.isOverridden).toBe(false);
    });

    it("should reset to defaults by setting isOverridden=false with default keywords", async () => {
      // User has custom config
      const customConfig: TimerKeywordsConfig = {
        enabled: true,
        hours: ["custom_h"],
        minutes: ["custom_m"],
        seconds: ["custom_s"],
        isOverridden: true,
      };

      await setConfig(ServerConfigKeys.TIMER_KEYWORDS, customConfig, testUserId, false);

      // Reset by setting defaults with isOverridden=false
      const resetConfig: TimerKeywordsConfig = {
        enabled: DEFAULT_KEYWORDS.enabled,
        hours: DEFAULT_KEYWORDS.hours,
        minutes: DEFAULT_KEYWORDS.minutes,
        seconds: DEFAULT_KEYWORDS.seconds,
        isOverridden: false,
      };

      await setConfig(ServerConfigKeys.TIMER_KEYWORDS, resetConfig, testUserId, false);

      // Verify reset
      const result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);

      expect(result?.hours).toEqual(DEFAULT_KEYWORDS.hours);
      expect(result?.minutes).toEqual(DEFAULT_KEYWORDS.minutes);
      expect(result?.seconds).toEqual(DEFAULT_KEYWORDS.seconds);
      expect(result?.isOverridden).toBe(false);
    });
  });

  describe("6. Enable/Disable Toggle", () => {
    it("should allow toggling enabled state without affecting keywords", async () => {
      await deleteConfig(ServerConfigKeys.TIMER_KEYWORDS);
      await seedDefaultTimerKeywords();

      // Disable feature
      const disabledConfig: TimerKeywordsConfig = {
        enabled: false,
        hours: DEFAULT_KEYWORDS.hours,
        minutes: DEFAULT_KEYWORDS.minutes,
        seconds: DEFAULT_KEYWORDS.seconds,
        isOverridden: false,
      };

      await setConfig(ServerConfigKeys.TIMER_KEYWORDS, disabledConfig, testUserId, false);

      let result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);

      expect(result?.enabled).toBe(false);
      expect(result?.hours).toEqual(DEFAULT_KEYWORDS.hours);
      expect(result?.minutes).toEqual(DEFAULT_KEYWORDS.minutes);
      expect(result?.seconds).toEqual(DEFAULT_KEYWORDS.seconds);

      // Re-enable feature
      const enabledConfig: TimerKeywordsConfig = {
        enabled: true,
        hours: DEFAULT_KEYWORDS.hours,
        minutes: DEFAULT_KEYWORDS.minutes,
        seconds: DEFAULT_KEYWORDS.seconds,
        isOverridden: false,
      };

      await setConfig(ServerConfigKeys.TIMER_KEYWORDS, enabledConfig, testUserId, false);

      result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);
      expect(result?.enabled).toBe(true);
      expect(result?.hours).toEqual(DEFAULT_KEYWORDS.hours);
      expect(result?.minutes).toEqual(DEFAULT_KEYWORDS.minutes);
      expect(result?.seconds).toEqual(DEFAULT_KEYWORDS.seconds);
    });

    it("should preserve user keywords when toggling enabled state", async () => {
      const customConfig: TimerKeywordsConfig = {
        enabled: true,
        hours: ["custom_h"],
        minutes: ["custom_m"],
        seconds: ["custom_s"],
        isOverridden: true,
      };

      await setConfig(ServerConfigKeys.TIMER_KEYWORDS, customConfig, testUserId, false);

      // Toggle to disabled
      customConfig.enabled = false;
      await setConfig(ServerConfigKeys.TIMER_KEYWORDS, customConfig, testUserId, false);

      let result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);

      expect(result?.enabled).toBe(false);
      expect(result?.hours).toEqual(["custom_h"]);
      expect(result?.minutes).toEqual(["custom_m"]);
      expect(result?.seconds).toEqual(["custom_s"]);

      // Toggle back to enabled
      customConfig.enabled = true;
      await setConfig(ServerConfigKeys.TIMER_KEYWORDS, customConfig, testUserId, false);

      result = await getConfig<TimerKeywordsConfig>(ServerConfigKeys.TIMER_KEYWORDS);
      expect(result?.enabled).toBe(true);
      expect(result?.hours).toEqual(["custom_h"]);
      expect(result?.minutes).toEqual(["custom_m"]);
      expect(result?.seconds).toEqual(["custom_s"]);
    });
  });
});
