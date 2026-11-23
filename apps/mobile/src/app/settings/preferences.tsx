import React from "react";
import { SettingsPlaceholderScreen } from "@/features/settings/screens/settings-placeholder-screen";

export default function PreferencesRoute() {
  return (
    <SettingsPlaceholderScreen
      testID="settings-preferences-screen"
      titleId="settings.user.preferences.title"
    />
  );
}
