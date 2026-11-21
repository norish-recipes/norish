import React, { useEffect } from "react";
import { Platform } from "react-native";
import { clearCalendarWidgets } from "@/lib/calendar-widgets";
import { Stack } from "expo-router";
import { useIntl } from "react-intl";

export default function AuthLayout() {
  const signIn = useIntl().formatMessage({ id: "calendar.widgets.signIn" });

  // Signed out, both widgets say "Open Norish to sign in" in the app's language and hold no photos.
  useEffect(() => void clearCalendarWidgets(signIn), [signIn]);

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: Platform.OS === "ios",
        headerShadowVisible: false,
        headerTitle: "",
        // The back button is the chevron alone, with no previous screen's title.
        headerBackButtonDisplayMode: "minimal",
        // The native push and pop between the auth screens.
        animation: "default",
      }}
    />
  );
}
