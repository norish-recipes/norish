import React from "react";
import { useIntl } from "react-intl";

import { AllergiesForm } from "../components/allergies-form";
import { SettingsPage } from "../components/settings-page";

/** Allergies: pick and remove the Reader's allergies, then Save. */
export function AllergiesScreen() {
  const intl = useIntl();

  return (
    <SettingsPage
      testID="settings-allergies-screen"
      title={intl.formatMessage({ id: "settings.user.allergies.title" })}
    >
      <AllergiesForm />
    </SettingsPage>
  );
}
