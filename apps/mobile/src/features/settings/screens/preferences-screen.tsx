import React from "react";
import { useIntl } from "react-intl";

import { PreferencesForm } from "../components/preferences-form";
import { SettingsPage } from "../components/settings-page";

/** Preferences: account-wide choices, the phone's Device Preferences and its Hidden Items. */
export function PreferencesScreen() {
  const intl = useIntl();

  return (
    <SettingsPage
      testID="settings-preferences-screen"
      title={intl.formatMessage({ id: "settings.user.preferences.title" })}
    >
      <PreferencesForm />
    </SettingsPage>
  );
}
