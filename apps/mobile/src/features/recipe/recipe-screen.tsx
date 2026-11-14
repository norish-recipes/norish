import React from "react";
import { Image, Text, View } from "react-native";
import { useServerImage } from "@/lib/network/server-url";
import { useLocalSearchParams } from "expo-router";
import { Skeleton } from "heroui-native";

import { useRecipeQuery } from "@norish/shared-react/recipes";
import { primaryRecipeImage } from "@norish/shared/lib/recipe-media";

/** A recipe's photo and name, as bars until it is read; the Recipe area replaces it. */
export function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipe } = useRecipeQuery(id);
  const toImage = useServerImage();
  const image = recipe ? primaryRecipeImage(recipe) : null;

  if (!recipe) {
    return (
      <View className="bg-background flex-1" testID="recipe-skeleton">
        <Skeleton className="h-72 w-full rounded-none" />
        <View className="px-5 pt-5">
          <Skeleton className="h-9 w-64 rounded-lg" />
        </View>
      </View>
    );
  }

  return (
    <View className="bg-background flex-1" testID="recipe-screen">
      {image ? (
        <Image className="h-72 w-full" source={toImage(image)} testID="recipe-photo" />
      ) : null}
      <Text className="text-foreground px-5 pt-5 text-3xl font-semibold" testID="recipe-name">
        {recipe.name}
      </Text>
    </View>
  );
}
