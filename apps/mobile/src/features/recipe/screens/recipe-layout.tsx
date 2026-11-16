import React from "react";
import { EDITOR_OPTIONS, FIT_SHEET_OPTIONS, SHEET_OPTIONS } from "@/components/sheet-options";
import { useMarkRecipeShown } from "@/lib/shown-recipe";
import { Stack, useLocalSearchParams } from "expo-router";

import { useIngredientsSubscription } from "@norish/shared-react/config";
import {
  RecipePageProvider,
  useRecipeEnrichmentSubscription,
  useRecipeShareSubscription,
  useRecipeSubscription,
} from "@norish/shared-react/recipes";

import { ScreenKeepAwake } from "../components/screen-keep-awake";

/** What the page keeps current: the recipe, its shares, its enrichment and the foods' icons. */
function RecipeSubscriptions({ recipeId }: { recipeId: string }) {
  useRecipeSubscription(recipeId);
  useRecipeShareSubscription(recipeId);
  useRecipeEnrichmentSubscription(recipeId);
  useIngredientsSubscription();

  return null;
}

/** The recipe route's own stack: the page and its sheets share one page store, so the Servings
 * sheet changes the servings the page shows. The header is transparent over the photo. */
export function RecipeLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();

  useMarkRecipeShown(id);

  return (
    <RecipePageProvider recipeId={id}>
      <RecipeSubscriptions recipeId={id} />
      <ScreenKeepAwake />
      <Stack
        screenOptions={{
          headerTransparent: true,
          headerShadowVisible: false,
          headerTitleStyle: { fontSize: 17, fontWeight: "600" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "" }} />
        <Stack.Screen name="servings" options={FIT_SHEET_OPTIONS} />
        <Stack.Screen name="share" options={SHEET_OPTIONS} />
        <Stack.Screen name="edit" options={EDITOR_OPTIONS} />
        <Stack.Screen
          name="viewer"
          options={{
            headerShown: false,
            presentation: "fullScreenModal",
            animation: "fade",
            gestureEnabled: false,
            statusBarStyle: "light",
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
        <Stack.Screen
          name="cook"
          options={{ headerShown: false, presentation: "fullScreenModal" }}
        />
      </Stack>
    </RecipePageProvider>
  );
}
