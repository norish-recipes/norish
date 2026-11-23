import React from "react";
import { useText } from "@/lib/i18n/use-text";

import { DangerZone } from "../components/danger-zone";
import { ProfileForm } from "../components/profile-form";
import { SettingsPage } from "../components/settings-page";
import { SignInMethods } from "../components/sign-in-methods";

/** Profile: photo, name and email with Save, the sign-in methods, and Delete account. */
export function ProfileScreen() {
  const text = useText();

  return (
    <SettingsPage testID="settings-profile-screen" title={text("settings.user.profile.title")}>
      <ProfileForm />
      <SignInMethods />
      <DangerZone />
    </SettingsPage>
  );
}
