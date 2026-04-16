import type { ServerConfigKey } from "@norish/db/zodSchemas/server-config";
import defaultContentIndicators from "@norish/config/content-indicators.default.json";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import defaultRecurrenceConfig from "@norish/config/recurrence-config.default.json";
import { DEFAULT_LOCALE_CONFIG } from "@norish/config/server-config-loader";
import defaultTimerKeywords from "@norish/config/timer-keywords.default.json";
import defaultUnits from "@norish/config/units.default.json";
import {
  DEFAULT_RECIPE_PERMISSION_POLICY,
  ServerConfigKeys,
} from "@norish/db/zodSchemas/server-config";

import { loadDefaultPrompts } from "../ai/prompts/loader";

export function getDefaultConfigValue(key: ServerConfigKey): unknown {
  switch (key) {
    case ServerConfigKeys.REGISTRATION_ENABLED:
      return true;
    case ServerConfigKeys.UNITS:
      return { units: defaultUnits, isOverridden: false };
    case ServerConfigKeys.CONTENT_INDICATORS:
      return defaultContentIndicators;
    case ServerConfigKeys.RECURRENCE_CONFIG:
      return defaultRecurrenceConfig;
    case ServerConfigKeys.SCHEDULER_CLEANUP_MONTHS:
      return 3;
    case ServerConfigKeys.AI_CONFIG:
      return {
        enabled: false,
        provider: "openai",
        model: "gpt-5-mini",
        temperature: 1.0,
        maxTokens: 10000,
      };
    case ServerConfigKeys.VIDEO_CONFIG:
      return {
        enabled: false,
        maxLengthSeconds: 120,
        maxVideoFileSize: SERVER_CONFIG.MAX_VIDEO_FILE_SIZE,
        ytDlpVersion: "2025.11.12",
        ytDlpProxy: undefined,
        transcriptionProvider: "disabled",
        transcriptionModel: "whisper-1",
      };
    case ServerConfigKeys.RECIPE_PERMISSION_POLICY:
      return DEFAULT_RECIPE_PERMISSION_POLICY;
    case ServerConfigKeys.PROMPTS:
      return { ...loadDefaultPrompts(), isOverridden: false };
    case ServerConfigKeys.LOCALE_CONFIG:
      return DEFAULT_LOCALE_CONFIG;
    case ServerConfigKeys.TIMER_KEYWORDS:
      return { ...defaultTimerKeywords, isOverridden: false };
    default:
      return null;
  }
}
