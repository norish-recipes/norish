import { useEffect } from "react";
import { useUserContext } from "@/lib/auth/user-context";
import { useMobileLocaleSettings } from "@/lib/i18n/mobile-i18n-context";

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
      setLocale(serverLocale, { fromServer: true });
    }
  }, [serverLocale, setLocale]);
}
