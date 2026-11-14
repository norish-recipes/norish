import React from "react";
import { FIT_SHEET_OPTIONS, SHEET_OPTIONS } from "@/components/sheet-options";
import { Stack } from "expo-router";

import { AddAtOnceHost } from "./add-at-once-host";
import { LibraryRoot } from "./library-root";

// The sheets whose content can outgrow 62%; the cookbook title sheets fit their content.
const SHEETS = [
  "filters",
  "plan-recipe",
  "plan",
  "add-to-groceries",
  "add-to-cookbook",
  "cookbook-add-recipes",
] as const;

const FIT_SHEETS = ["cookbook-rename", "new-cookbook"] as const;

/** The Recipes tab's stack: the list screen draws its own title and avatar and has no native header; a cookbook page keeps a transparent one for its back button. */
export function RecipesStack() {
  return (
    <LibraryRoot>
      <AddAtOnceHost>
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
