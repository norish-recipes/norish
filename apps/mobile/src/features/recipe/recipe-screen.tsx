import React from "react";
import { Image, Text, View } from "react-native";
import { useServerUrl } from "@/lib/network/server-url";
import { useLocalSearchParams } from "expo-router";

import { useRecipeQuery } from "@norish/shared-react/recipes";
import { primaryRecipeImage } from "@norish/shared/lib/recipe-media";

/** A recipe's photo and name; the Recipe area replaces it. */
export function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipe } = useRecipeQuery(id);
  const toUrl = useServerUrl();
  const image = recipe ? primaryRecipeImage(recipe) : null;

  return (
    <View className="bg-background flex-1" testID="recipe-screen">
      {image ? (
        <Image className="h-72 w-full" source={{ uri: toUrl(image) }} testID="recipe-photo" />
      ) : null}
      <Text className="text-foreground px-5 pt-5 text-3xl font-semibold" testID="recipe-name">
        {recipe?.name ?? ""}
      </Text>
    </View>
  );
}
