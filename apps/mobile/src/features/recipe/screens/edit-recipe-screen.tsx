import React, { useEffect, useState } from "react";
import { useHideTabBar } from "@/lib/tab-bar-visibility";
import { recipeRoute } from "@/lib/tab-routes";
import { useLocalSearchParams, useRouter } from "expo-router";

import { useRecipePermissions } from "@norish/shared-react/reader";
import { useRecipeQuery } from "@norish/shared-react/recipes";
import { isNotFoundError } from "@norish/shared-react/trpc";

import { RecipeEditorScreen } from "./recipe-editor-screen";

/** Edit: the editor on the recipe from the Warm Set or the server, for a reader who may edit it;
 * a skeleton until then, and the not-found state once it is deleted while open. */
export function EditRecipeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipe, error } = useRecipeQuery(id);
  const { isLoading: checking, canEditRecipe } = useRecipePermissions();
  const [loaded, setLoaded] = useState(false);
  const refused = !!recipe && !checking && !canEditRecipe(recipe.householdId);

  if (recipe && !loaded) setLoaded(true);

  // The same check as hides Edit; a reader who may not edit is left on the Recipe screen.
  useEffect(() => {
    if (refused) router.dismissTo(recipeRoute(id));
  }, [refused, router, id]);

  useHideTabBar();

  const ready = recipe && !checking && !refused ? recipe : undefined;

  // Keyed by what it holds, so the recipe arriving opens the editor on it.
  return (
    <RecipeEditorScreen
      key={ready?.id ?? "pending"}
      initialData={ready}
      mode="edit"
      notFound={!recipe && (loaded || isNotFoundError(error))}
    />
  );
}
