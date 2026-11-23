import React from "react";
import { useText } from "@/lib/i18n/use-text";

import { AllergiesForm } from "../components/allergies-form";
import { SettingsPage } from "../components/settings-page";

/** Allergies: pick and remove the Reader's allergies, then Save. */
export function AllergiesScreen() {
  const text = useText();

  return (
    <SettingsPage testID="settings-allergies-screen" title={text("settings.user.allergies.title")}>
      <AllergiesForm />
    </SettingsPage>
  );
}
