import React from "react";
import { SettingsPlaceholderScreen } from "@/features/settings/screens/settings-placeholder-screen";

export default function ProfileRoute() {
  return (
    <SettingsPlaceholderScreen
      testID="settings-profile-screen"
      titleId="settings.user.profile.title"
    />
  );
}
