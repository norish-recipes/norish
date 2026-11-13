import { useEffect } from "react";
import { useMobileLocaleSettings } from "@/lib/i18n/mobile-i18n-context";

import { useReader } from "@norish/shared-react/reader";
import { getLocalePreference } from "@norish/shared/lib/user-preferences";

/**
 * Syncs the authenticated user's server-side locale preference into the
 * locale provider. This covers the case where a user sets their locale
 * on another platform (e.g. web) and mobile should pick it up.
 *
 * Must be called inside both the platform adapter and `MobileIntlProvider`.
 */
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
