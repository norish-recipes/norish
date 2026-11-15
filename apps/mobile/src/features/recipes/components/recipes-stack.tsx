import React from "react";
import { FIT_SHEET_OPTIONS, SHEET_OPTIONS } from "@/components/sheet-options";
import { TAB_ROUTES } from "@/lib/tab-routes";
import { Stack } from "expo-router";

import { AddAtOnceHost } from "./add-at-once-host";
import { LibraryRoot } from "./library-root";

// The sheets whose content can outgrow 62%; Rename fits its field.
const SHEETS = [
  "filters",
  "plan-recipe",
  "plan",
  "add-to-groceries",
  "add-to-cookbook",
  "cookbook-add-recipes",
  "new-cookbook",
] as const;

const FIT_SHEETS = ["cookbook-rename"] as const;

/** The Recipes tab's stack: the list screen draws its own title and avatar and has no native header; a cookbook page keeps a transparent one for its back button. */
export function RecipesStack() {
  return (
    <LibraryRoot>
      <AddAtOnceHost addToGroceries={TAB_ROUTES.recipes.addToGroceries}>
        <Stack
          screenOptions={{
            headerTransparent: true,
            headerShadowVisible: false,
            headerTitleStyle: { fontSize: 17, fontWeight: "600" },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          {/* A cookbook opens inside this stack so its sheets present over it. */}
          <Stack.Screen
            name="cookbook/[id]"
            options={{ title: "", headerBackButtonDisplayMode: "minimal" }}
          />
          {/* A recipe opens inside this stack too, with its own nested stack for its sheets. */}
          <Stack.Screen name="recipe/[id]" options={{ headerShown: false }} />
          {SHEETS.map((name) => (
            <Stack.Screen key={name} name={name} options={SHEET_OPTIONS} />
          ))}
          {FIT_SHEETS.map((name) => (
            <Stack.Screen key={name} name={name} options={FIT_SHEET_OPTIONS} />
          ))}
        </Stack>
      </AddAtOnceHost>
    </LibraryRoot>
  );
}
