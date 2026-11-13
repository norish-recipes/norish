import React from "react";
import { AccountAvatar } from "@/components/account-avatar";
import { Stack } from "expo-router";
import { useIntl } from "react-intl";

import { LibraryRoot } from "./library-root";

// The sheets the card actions open; their tickets fill them.
const SHEETS = [
  "plan",
  "add-to-groceries",
  "add-to-cookbook",
  "cookbook-add-recipes",
  "cookbook-rename",
] as const;

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
          // The board draws the avatar bare, without iOS 26's shared glass capsule.
          unstable_headerRightItems: () => [
            { type: "custom", element: <AccountAvatar />, hidesSharedBackground: true },
          ],
        }}
      >
        <Stack.Screen
          name="filters"
          options={{
            presentation: "formSheet",
            headerShown: false,
            sheetGrabberVisible: true,
            // A detent is a fraction of the sheet's ~800 pt maximum; the board's sheet is 664 pt.
            sheetAllowedDetents: [0.83],
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen
          name="plan-recipe"
          options={{
            presentation: "formSheet",
            headerShown: false,
            sheetGrabberVisible: true,
            // The board's sheet is 619 pt (a 0.785 detent) of the ~800 pt maximum.
            sheetAllowedDetents: [0.785],
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        {SHEETS.map((name) => (
          <Stack.Screen
            key={name}
            name={name}
            options={{
              presentation: "formSheet",
              headerShown: false,
              sheetGrabberVisible: true,
              sheetAllowedDetents: [0.5],
            }}
          />
        ))}
      </Stack>
    </LibraryRoot>
  );
}
