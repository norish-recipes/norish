import React, { useEffect, useState } from "react";
import { recipeRoute } from "@/lib/tab-routes";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ownerAllows, useRecipePermissions } from "@norish/shared-react/reader";
import { useRecipeQuery } from "@norish/shared-react/recipes";

import { EditorHeader } from "../components/editor/editor-header";
import { isRecipeNotFound, RecipeNotFound } from "../components/recipe-not-found";
import { RecipeEditorScreen, RecipeEditorSkeleton } from "./recipe-editor-screen";

/** Edit: the editor on the recipe from the Warm Set or the server, for a reader who may edit it;
 * a skeleton until then, and the not-found state once it is deleted while open. */
export function EditRecipeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipe, error } = useRecipeQuery(id);
  const { isLoading: checking, canEditRecipe } = useRecipePermissions();
  const [loaded, setLoaded] = useState(false);
  const refused = !!recipe && !checking && !ownerAllows(recipe.userId, canEditRecipe);

  if (recipe && !loaded) setLoaded(true);

  // The same check as hides Edit; a reader who may not edit is left on the Recipe screen.
  useEffect(() => {
    if (refused) router.dismissTo(recipeRoute(id));
  }, [refused, router, id]);

  if (recipe && !checking && !refused) {
    return <RecipeEditorScreen key={recipe.id} initialData={recipe} mode="edit" />;
  }

  return !recipe && (loaded || isRecipeNotFound(error)) ? (
    <>
      <EditorHeader mode="edit" />
      <RecipeNotFound />
    </>
  ) : (
    <RecipeEditorSkeleton mode="edit" />
  );
}
