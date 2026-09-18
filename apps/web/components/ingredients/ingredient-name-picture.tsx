"use client";

import { IngredientIllustration } from "@/components/recipes/ingredient-illustration";
import { useIngredientNamesQuery } from "@/hooks/config";

import { findIngredientForName } from "@norish/shared/lib/ingredient-pictures";

/**
 * The Ingredient Illustration a name matches (ADR-0037), for the surfaces that
 * hold a name rather than a recipe line: a grocery, and a Pantry Item. The
 * match runs on the device against the cached names, so a hand-typed "eggs"
 * gets the same picture as one added from a recipe, and the picture is still
 * there offline. Renders nothing for a name with no picture.
 */
export function IngredientNamePicture({
  name,
  dimmed = false,
}: {
  name: string | null | undefined;
  dimmed?: boolean;
}) {
  const { lookup } = useIngredientNamesQuery();
  const imageUrl = findIngredientForName(lookup, name)?.imageUrl;

  return (
    <IngredientIllustration
      className={`transition-opacity ${dimmed ? "opacity-50" : ""}`}
      imageUrl={imageUrl}
      size="sm"
    />
  );
}
