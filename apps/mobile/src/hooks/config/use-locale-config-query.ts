import type { EnabledLocale, LocaleConfigResult } from "@norish/shared-react/hooks";

import { sharedConfigHooks } from "./shared-config-hooks";

export type { EnabledLocale, LocaleConfigResult };

export function useLocaleConfigQuery() {
  return sharedConfigHooks.useLocaleConfigQuery();
}
