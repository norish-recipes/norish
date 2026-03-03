import type { UseQueryOptions } from '@tanstack/react-query';

export type QueryOptionsFactory = (...args: unknown[]) => Record<string, unknown>;

export type ConfigQueryBinding = {
  localeConfig: { queryOptions: QueryOptionsFactory };
  tags: { queryOptions: QueryOptionsFactory };
  units: { queryOptions: QueryOptionsFactory };
  recurrenceConfig: { queryOptions: QueryOptionsFactory };
  timerKeywords: { queryOptions: QueryOptionsFactory };
  uploadLimits: { queryOptions: QueryOptionsFactory };
  timersEnabled: { queryOptions: QueryOptionsFactory };
};

export type TrpcHookBinding = {
  config: ConfigQueryBinding;
};

export interface EnabledLocale {
  code: string;
  name: string;
}

export interface LocaleConfigResult {
  defaultLocale: string;
  enabledLocales: EnabledLocale[];
}

export interface UploadLimits {
  maxAvatarSize: number;
  maxImageSize: number;
  maxVideoSize: number;
}

export interface TimerKeywordsConfig {
  enabled: boolean;
  hours: string[];
  minutes: string[];
  seconds: string[];
  isOverridden: boolean;
}

export interface CreateConfigHooksOptions {
  useTRPC: () => unknown;
}

export function getQueryOptions(factory: QueryOptionsFactory): UseQueryOptions {
  return factory() as unknown as UseQueryOptions;
}
