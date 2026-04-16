import { useEffect } from "react";
import { useMobileLocaleSettings } from "@/context/mobile-i18n-context";
import { useUserContext } from "@/context/user-context";

import { getLocalePreference } from "@norish/shared/lib/user-preferences";

/**
 * Syncs the authenticated user's server-side locale preference into the
 * locale provider. This covers the case where a user sets their locale
 * on another platform (e.g. web) and mobile should pick it up.
 *
 * Must be called inside both `UserProvider` and `MobileIntlProvider`.
 */
export function useUserLocaleSync() {
  const { user } = useUserContext();
  const { setLocale } = useMobileLocaleSettings();

  const serverLocale = getLocalePreference(user);

  useEffect(() => {
    if (serverLocale) {
      setLocale(serverLocale);
    }
  }, [serverLocale, setLocale]);
}
