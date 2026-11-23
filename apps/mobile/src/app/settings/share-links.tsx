import React from "react";
import { SettingsPlaceholderScreen } from "@/features/settings/screens/settings-placeholder-screen";

export default function ShareLinksRoute() {
  return (
    <SettingsPlaceholderScreen
      testID="settings-share-links-screen"
      titleId="settings.user.shareLinks.title"
    />
  );
}
