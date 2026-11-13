import React from "react";
import { AccountAvatar } from "@/components/account-avatar";
import { FIT_SHEET_OPTIONS, SHEET_OPTIONS } from "@/components/sheet-options";
import { Stack } from "expo-router";

import { AddAtOnceHost } from "./add-at-once-host";
import { LibraryRoot } from "./library-root";

// The sheets whose content can outgrow 62%; cookbook-rename's fits its content.
const SHEETS = [
  "filters",
  "plan-recipe",
  "plan",
  "add-to-groceries",
  "add-to-cookbook",
  "cookbook-add-recipes",
] as const;

/** The Recipes tab's stack: a transparent native header with the account avatar pinned right; the screen draws its own large title. */
export function RecipesStack() {
  return (
    <LibraryRoot>
      <AddAtOnceHost>
        <Stack
          screenOptions={{
            headerTransparent: true,
            headerShadowVisible: false,
            headerTitleStyle: { fontSize: 17, fontWeight: "600" },
            unstable_headerRightItems: () => [{ type: "custom", element: <AccountAvatar /> }],
          }}
        >
          {SHEETS.map((name) => (
            <Stack.Screen key={name} name={name} options={SHEET_OPTIONS} />
          ))}
          <Stack.Screen name="cookbook-rename" options={FIT_SHEET_OPTIONS} />
        </Stack>
      </AddAtOnceHost>
    </LibraryRoot>
  );
}
