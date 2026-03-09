import type { CreateConfigHooksOptions } from "./types";
import { createUseLocaleConfigQuery } from "./use-locale-config-query";
import { createUseRecurrenceConfigQuery } from "./use-recurrence-config-query";
import { createUseTagsQuery } from "./use-tags-query";
import { createUseTimerKeywordsQuery } from "./use-timer-keywords-query";
import { createUseTimersEnabledBaseQuery } from "./use-timers-enabled-base-query";
import { createUseUnitsQuery } from "./use-units-query";
import { createUseUploadLimitsQuery } from "./use-upload-limits-query";

export type {
  CreateConfigHooksOptions,
  EnabledLocale,
  LocaleConfigResult,
  TimerKeywordsConfig,
  UploadLimits,
} from "./types";

export { normalizeLocaleConfig } from "./normalize-locale-config";
export { createUseLocaleConfigQuery } from "./use-locale-config-query";
export { createUseTagsQuery } from "./use-tags-query";
export { createUseUnitsQuery } from "./use-units-query";
export { createUseRecurrenceConfigQuery } from "./use-recurrence-config-query";
export { createUseTimerKeywordsQuery } from "./use-timer-keywords-query";
export { createUseUploadLimitsQuery } from "./use-upload-limits-query";
export { createUseTimersEnabledBaseQuery } from "./use-timers-enabled-base-query";
export { createUseVersionQuery } from "./use-version-query";

export function createConfigHooks(options: CreateConfigHooksOptions) {
  return {
    useLocaleConfigQuery: createUseLocaleConfigQuery(options),
    useTagsQuery: createUseTagsQuery(options),
    useUnitsQuery: createUseUnitsQuery(options),
    useRecurrenceConfigQuery: createUseRecurrenceConfigQuery(options),
    useTimerKeywordsQuery: createUseTimerKeywordsQuery(options),
    useUploadLimitsQuery: createUseUploadLimitsQuery(options),
    useTimersEnabledBaseQuery: createUseTimersEnabledBaseQuery(options),
  };
}
