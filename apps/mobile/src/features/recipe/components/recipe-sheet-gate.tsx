import type { SheetActions } from "@/components/modal-header";
import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { Sheet } from "@/components/sheet";
import { useLocalSearchParams } from "expo-router";

import { useRecipeQuery } from "@norish/shared-react/recipes";
import { isNotFoundError } from "@norish/shared-react/trpc";

import { RecipeNotFound } from "./recipe-not-found";

/** A recipe's sheet behind a link: `children` (and `actions`) once the recipe is read, else an
 * empty sheet or, where the server says it is gone, the not-found state. */
export function RecipeSheetGate({
  name,
  title,
  subtitle,
  actions,
  children,
}: {
  name: string;
  title: string;
  /** The sheet's subtitle, from the recipe's name. */
  subtitle?: (recipeName: string) => string;
  actions?: SheetActions;
  children: ReactNode;
}) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipe, error } = useRecipeQuery(id);

  return (
    <Sheet
      {...(recipe ? actions : undefined)}
      name={name}
      subtitle={recipe && subtitle ? subtitle(recipe.name) : undefined}
      title={title}
    >
      {recipe ? (
        children
      ) : isNotFoundError(error) ? (
        // A fit sheet is as tall as its content, which a centred state has none of.
        <View className="h-64">
          <RecipeNotFound />
        </View>
      ) : null}
    </Sheet>
  );
}
