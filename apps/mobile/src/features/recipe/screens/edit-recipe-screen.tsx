import React from "react";
import { useLocalSearchParams } from "expo-router";

import { useRecipeQuery } from "@norish/shared-react/recipes";

import { isRecipeNotFound, RecipeNotFound } from "../components/recipe-not-found";
import { RecipeEditorScreen, RecipeEditorSkeleton } from "./recipe-editor-screen";

/** Edit: the editor on the recipe as the Warm Set or the server has it. */
export function EditRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipe, error } = useRecipeQuery(id);

  if (!recipe && isRecipeNotFound(error)) return <RecipeNotFound />;

  return recipe ? (
    <RecipeEditorScreen key={recipe.id} initialData={recipe} mode="edit" />
  ) : (
    <RecipeEditorSkeleton />
  );
}
