import type { inferRouterOutputs } from "@trpc/server";
import type { createTRPCContext } from "@trpc/tanstack-react-query";

import type { AppRouter } from "@norish/trpc/client";

type ConfigOutputs = inferRouterOutputs<AppRouter>["config"];
type TrpcContext = ReturnType<typeof createTRPCContext<AppRouter>>;

export type TrpcHookBinding = ReturnType<TrpcContext["useTRPC"]>;
export type EnabledLocale = ConfigOutputs["localeConfig"]["enabledLocales"][number];
export type LocaleConfigResult = ConfigOutputs["localeConfig"];
export type UploadLimits = ConfigOutputs["uploadLimits"];
export type TimerKeywordsConfig = ConfigOutputs["timerKeywords"];

export interface CreateConfigHooksOptions {
  useTRPC: () => TrpcHookBinding;
}
