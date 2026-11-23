import React from "react";
import { useIntl } from "react-intl";

import { DangerZone } from "../components/danger-zone";
import { ProfileForm } from "../components/profile-form";
import { SettingsPage } from "../components/settings-page";
import { SignInMethods } from "../components/sign-in-methods";

/** Profile: photo, name and email with Save, the sign-in methods, and Delete account. */
export function ProfileScreen() {
  const intl = useIntl();

  return (
    <SettingsPage
      testID="settings-profile-screen"
      title={intl.formatMessage({ id: "settings.user.profile.title" })}
    >
      <ProfileForm />
      <SignInMethods />
      <DangerZone />
    </SettingsPage>
  );
}
