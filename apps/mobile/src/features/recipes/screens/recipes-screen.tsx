import React from "react";
import { ScrollView } from "react-native";

/** The Recipes tab; Today and the Library arrive with their tickets. */
export function RecipesScreen() {
  return (
    <ScrollView
      className="bg-background flex-1"
      contentInsetAdjustmentBehavior="automatic"
      testID="recipes-screen"
    />
  );
}
