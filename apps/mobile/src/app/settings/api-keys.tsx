import React from "react";
import { SettingsPlaceholderScreen } from "@/features/settings/screens/settings-placeholder-screen";

export default function ApiKeysRoute() {
  return (
    <SettingsPlaceholderScreen
      testID="settings-api-keys-screen"
      titleId="settings.user.apiKeys.title"
    />
  );
}
