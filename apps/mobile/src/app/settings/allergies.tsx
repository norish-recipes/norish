import React from "react";
import { SettingsPlaceholderScreen } from "@/features/settings/screens/settings-placeholder-screen";

export default function AllergiesRoute() {
  return (
    <SettingsPlaceholderScreen
      testID="settings-allergies-screen"
      titleId="settings.user.allergies.title"
    />
  );
}
