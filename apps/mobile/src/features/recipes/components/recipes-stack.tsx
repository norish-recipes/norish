import React from "react";
import { AccountAvatar } from "@/components/account-avatar";
import { Stack } from "expo-router";
import { useIntl } from "react-intl";

/** The Recipes tab's stack: iOS's own large title, collapsing on scroll, with the account avatar on its right. */
export function RecipesStack() {
  const intl = useIntl();

  return (
    <Stack
      screenOptions={{
        title: intl.formatMessage({ id: "navbar.nav.home" }),
        headerLargeTitle: true,
        headerTransparent: true,
        headerLargeTitleShadowVisible: false,
        headerRight: () => <AccountAvatar />,
      }}
    />
  );
}
