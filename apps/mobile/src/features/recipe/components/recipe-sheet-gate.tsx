import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { Sheet } from "@/components/sheet";
import { useLocalSearchParams } from "expo-router";

import { useRecipeQuery } from "@norish/shared-react/recipes";

import { isRecipeNotFound, RecipeNotFound } from "./recipe-not-found";

/** A recipe's sheet behind a link: its children once the recipe is read, else an empty sheet or,
 * where the server says it is gone, the not-found state. */
export function RecipeSheetGate({
  name,
  title,
  children,
}: {
  name: string;
  title: string;
  children: ReactNode;
}) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipe, error } = useRecipeQuery(id);

  if (recipe) return children;

  return (
    <Sheet name={name} title={title}>
      {isRecipeNotFound(error) ? (
        // A fit sheet is as tall as its content, which a centred state has none of.
        <View className="h-64">
          <RecipeNotFound />
        </View>
      ) : null}
    </Sheet>
  );
}
