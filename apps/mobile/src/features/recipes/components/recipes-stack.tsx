import type { ComponentType, ReactNode } from "react";
import React from "react";
import { FIT_SHEET_OPTIONS, SEARCH_SHEET_OPTIONS, SHEET_OPTIONS } from "@/components/sheet-options";
import { HEADER_TITLE_STYLE } from "@/lib/header-title";
import { TAB_ROUTES } from "@/lib/tab-routes";
import { Stack } from "expo-router";

import { AddAtOnceHost } from "./add-at-once-host";
import { LibraryRoot } from "./library-root";

// The sheets whose content can outgrow 62%; Rename and Move fit their fields.
const SHEETS = ["filters", "add-to-groceries"] as const;

// The list sheets: a field above a list, or a list of days.
const SEARCH_SHEETS = [
  "plan",
  "plan-recipe",
  "add-to-cookbook",
  "cookbook-add-recipes",
  "new-cookbook",
] as const;

const FIT_SHEETS = ["cookbook-rename", "move"] as const;

/**
 * The Recipes tab's stack: the list screen's title is a bar item that hides on scroll; a cookbook page keeps a transparent header for its back button.
 * Search's stack is this one, given its own filters in `search`, rooted at its own screen.
 */
export function RecipesStack({ search }: { search?: ComponentType<{ children: ReactNode }> }) {
  const Root = search ?? LibraryRoot;

  return (
    <Root>
      <AddAtOnceHost addToGroceries={TAB_ROUTES.recipes.addToGroceries}>
        <Stack
          screenOptions={{
            headerTransparent: true,
            headerShadowVisible: false,
            headerTitleStyle: HEADER_TITLE_STYLE,
          }}
        >
          {/* The root screen sets its header itself: Recipes a bar-item title, Search its field. */}
          <Stack.Screen name={search ? "search" : "index"} />
          {/* A cookbook opens inside this stack so its sheets present over it. */}
          <Stack.Screen
            name="cookbook/[id]"
            options={{
              title: "",
              headerBackButtonDisplayMode: "minimal",
              scrollEdgeEffects: { top: "soft" },
            }}
          />
          {/* A recipe opens inside this stack too, with its own nested stack for its sheets. */}
          <Stack.Screen name="recipe/[id]" options={{ headerShown: false }} />
          {SHEETS.map((name) => (
            <Stack.Screen key={name} name={name} options={SHEET_OPTIONS} />
          ))}
          {SEARCH_SHEETS.map((name) => (
            <Stack.Screen key={name} name={name} options={SEARCH_SHEET_OPTIONS} />
          ))}
          {FIT_SHEETS.map((name) => (
            <Stack.Screen key={name} name={name} options={FIT_SHEET_OPTIONS} />
          ))}
        </Stack>
      </AddAtOnceHost>
    </Root>
  );
}
