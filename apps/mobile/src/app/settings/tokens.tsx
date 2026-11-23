import React from "react";
import { SettingsPlaceholderScreen } from "@/features/settings/screens/settings-placeholder-screen";

export default function TokensRoute() {
  return (
    <SettingsPlaceholderScreen
      testID="settings-tokens-screen"
      titleId="settings.user.siteAuthTokens.title"
    />
  );
}
