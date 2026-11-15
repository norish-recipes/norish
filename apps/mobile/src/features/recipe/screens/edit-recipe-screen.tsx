import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassCloseButton } from "@/components/glass";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ownerAllows, useRecipePermissions } from "@norish/shared-react/reader";
import { useRecipeQuery } from "@norish/shared-react/recipes";

import { isRecipeNotFound, RecipeNotFound } from "../components/recipe-not-found";
import { RecipeEditorScreen, RecipeEditorSkeleton } from "./recipe-editor-screen";

/**
 * Edit: the editor on the recipe as the Warm Set or the server has it, for a reader who may edit
 * it. Until then a skeleton, and once the recipe is gone (deleted while open) the not-found state.
 */
export function EditRecipeScreen() {
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipe, error } = useRecipeQuery(id);
  const { isLoading: checking, canEditRecipe } = useRecipePermissions();
  const [loaded, setLoaded] = useState(false);
  const refused = !!recipe && !checking && !ownerAllows(recipe.userId, canEditRecipe);

  if (recipe && !loaded) setLoaded(true);

  // The same check as hides Edit; a reader who may not edit is left on the Recipe screen.
  useEffect(() => {
    if (refused) router.dismissTo({ pathname: "/recipe/[id]", params: { id } });
  }, [refused, router, id]);

  if (recipe && !checking && !refused) {
    return <RecipeEditorScreen key={recipe.id} initialData={recipe} mode="edit" />;
  }

  return (
    <View className="bg-background flex-1">
      {!recipe && (loaded || isRecipeNotFound(error)) ? <RecipeNotFound /> : <RecipeEditorSkeleton />}
      <View className="absolute left-4" style={{ top: top + 6 }}>
        <GlassCloseButton testID="recipe-editor-close" onPress={() => router.back()} />
      </View>
    </View>
  );
}
