import type { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@norish/trpc/client";

type ConfigOutputs = inferRouterOutputs<AppRouter>["config"];
export type EnabledLocale = ConfigOutputs["localeConfig"]["enabledLocales"][number];
export type LocaleConfigResult = ConfigOutputs["localeConfig"];
export type UploadLimits = ConfigOutputs["uploadLimits"];
export type TimerKeywordsConfig = ConfigOutputs["timerKeywords"];
