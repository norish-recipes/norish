import { useEffect } from "react";
import { useMobileLocaleSettings } from "@/lib/i18n/mobile-i18n-context";

import { useReader } from "@norish/shared-react/reader";
import { getLocalePreference } from "@norish/shared/lib/user-preferences";

/** Applies the user's server-side locale, so one set on web reaches the app; call it inside both
 * the platform adapter and `MobileIntlProvider`. */
export function useUserLocaleSync() {
  const { user } = useReader();
  const { setLocale } = useMobileLocaleSettings();

  const serverLocale = getLocalePreference(user);

  useEffect(() => {
    if (serverLocale) {
      setLocale(serverLocale, { fromServer: true });
    }
  }, [serverLocale, setLocale]);
}
