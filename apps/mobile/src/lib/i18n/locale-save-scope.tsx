import type { MobileLocaleContextValue } from "@/lib/i18n/mobile-i18n-context";
import type { ReactNode } from "react";
import { MobileLocaleContext, useMobileLocaleSettings } from "@/lib/i18n/mobile-i18n-context";

import { usePreferencesMutation } from "@norish/shared-react/reader";

/** Signed in, below the platform adapter: saves a language the reader picks, one save at a time,
 * and puts back the shown one when the server does not take it. */
export function LocaleSaveScope({ children }: { children: ReactNode }) {
  const shown = useMobileLocaleSettings();
  const { updatePreferences, isUpdatingPreferences } = usePreferencesMutation();

  const value: MobileLocaleContextValue = {
    ...shown,
    setLocale: (nextLocale, options) => {
      if (options?.fromServer) return shown.setLocale(nextLocale);
      if (nextLocale === shown.locale || isUpdatingPreferences) return;
      const previous = shown.locale;

      shown.setLocale(nextLocale);
      void updatePreferences({ locale: nextLocale }).then((took) => {
        if (!took) shown.setLocale(previous);
      });
    },
  };

  return <MobileLocaleContext value={value}>{children}</MobileLocaleContext>;
}
