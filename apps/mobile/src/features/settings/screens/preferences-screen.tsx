import React from "react";
import { useText } from "@/lib/i18n/use-text";

import { PreferencesForm } from "../components/preferences-form";
import { SettingsPage } from "../components/settings-page";

/** Preferences: account-wide choices, the phone's Device Preferences and its Hidden Items. */
export function PreferencesScreen() {
  const text = useText();

  return (
    <SettingsPage
      testID="settings-preferences-screen"
      title={text("settings.user.preferences.title")}
    >
      <PreferencesForm />
    </SettingsPage>
  );
}
