import React from "react";
import { AccountAvatar } from "@/components/account-avatar";
import { Stack } from "expo-router";
import { useIntl } from "react-intl";

import { LibraryRoot } from "./library-root";

/** The Recipes tab's stack: iOS's own large title, collapsing on scroll, with the account avatar on its right. */
export function RecipesStack() {
  const intl = useIntl();

  return (
    <LibraryRoot>
      <Stack
        screenOptions={{
          title: intl.formatMessage({ id: "navbar.nav.home" }),
          headerLargeTitle: true,
          headerTransparent: true,
          headerLargeTitleShadowVisible: false,
          headerRight: () => <AccountAvatar />,
        }}
      >
        <Stack.Screen
          name="filters"
          options={{
            presentation: "formSheet",
            headerShown: false,
            sheetGrabberVisible: true,
            sheetAllowedDetents: [0.92],
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
      </Stack>
    </LibraryRoot>
  );
}
