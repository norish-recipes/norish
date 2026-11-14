import React from "react";
import { Text } from "react-native";
import { useIntl } from "react-intl";

import { useHiddenItemVisibility } from "@norish/shared-react/reader";
import { useLoadedPageRecipe } from "@norish/shared-react/recipes";

import { plainText } from "../utils/recipe-rows";
import { SectionCard } from "./tint";

export function NotesSection() {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const { showNotes } = useHiddenItemVisibility();

  if (!recipe.notes || !showNotes) return null;

  return (
    <SectionCard testID="recipe-notes" title={intl.formatMessage({ id: "recipes.detail.notes" })}>
      <Text className="text-foreground text-base leading-6">{plainText(recipe.notes)}</Text>
    </SectionCard>
  );
}
