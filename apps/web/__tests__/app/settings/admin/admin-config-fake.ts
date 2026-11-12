/** What `useAdminConfig` reads in a component test, by config key; a test sets the ones it needs. */
export const configs: Record<string, unknown> = {};

export function setConfigs(next: Record<string, unknown>) {
  for (const key of Object.keys(configs)) delete configs[key];
  Object.assign(configs, next);
}

export const useAdminConfig = (key: string, select?: (value: unknown) => unknown) =>
  select ? select(configs[key]) : configs[key];
