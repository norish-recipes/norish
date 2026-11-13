import React from "react";
import { AccountAvatar } from "@/components/account-avatar";
import { Stack } from "expo-router";

import { LibraryRoot } from "./library-root";

// The sheets the card actions open; their tickets fill them.
const SHEETS = [
  "add-to-groceries",
  "add-to-cookbook",
  "cookbook-add-recipes",
  "cookbook-rename",
] as const;

/** The Recipes tab's stack: a transparent native header with the account avatar pinned right; the screen draws its own large title. */
export function RecipesStack() {
  return (
    <LibraryRoot>
      <Stack
        screenOptions={{
          headerTransparent: true,
          headerShadowVisible: false,
          headerTitleStyle: { fontSize: 17, fontWeight: "600" },
          unstable_headerRightItems: () => [{ type: "custom", element: <AccountAvatar /> }],
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
        <Stack.Screen
          name="plan"
          options={{
            presentation: "formSheet",
            headerShown: false,
            sheetGrabberVisible: true,
            // The board's sheet is 804 pt; the largest detent is an opaque full-width sheet, so stay under it.
            sheetAllowedDetents: [0.95],
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
