import type { MobileLocaleContextValue } from "@/lib/i18n/mobile-i18n-context";
import type { ReactNode } from "react";
import { isOffered } from "@/lib/i18n/locale-state";
import { MobileLocaleContext, useMobileLocaleSettings } from "@/lib/i18n/mobile-i18n-context";

import { usePreferencesMutation } from "@norish/shared-react/reader";

/** Signed in, below the platform adapter: a language the reader picks is saved to the profile, one
 * save at a time; the profile's saved language is what shows, through every answer. */
export function LocaleSaveScope({ children }: { children: ReactNode }) {
  const shown = useMobileLocaleSettings();
  const { updatePreferences, isUpdatingPreferences } = usePreferencesMutation();

  const value: MobileLocaleContextValue = {
    ...shown,
    setLocale: (nextLocale) => {
      if (
        nextLocale !== shown.locale &&
        !isUpdatingPreferences &&
        isOffered(shown.options, nextLocale)
      )
        void updatePreferences({ locale: nextLocale });
    },
  };

  return <MobileLocaleContext value={value}>{children}</MobileLocaleContext>;
}
