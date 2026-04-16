import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { CookModeModal } from "@/components/recipe-detail/cook-mode";
import { ParallaxScrollView } from "@/components/recipe-detail/parallax-scroll-view";
import { RecipeAuthor } from "@/components/recipe-detail/recipe-author";
import { RecipeHighlights } from "@/components/recipe-detail/recipe-highlights";
import { RecipeIngredients } from "@/components/recipe-detail/recipe-ingredients";
import { RecipeMediaHeader } from "@/components/recipe-detail/recipe-media-header";
import { RecipeNutrition } from "@/components/recipe-detail/recipe-nutrition";
import { RecipeQuickActions } from "@/components/recipe-detail/recipe-quick-actions";
import { RecipeLikedButton, RecipeRating } from "@/components/recipe-detail/recipe-rating";
import { RecipeSteps } from "@/components/recipe-detail/recipe-steps";
import { RecipeTags } from "@/components/recipe-detail/recipe-tags";
import { SmartText } from "@/components/recipe-detail/text-renderer";
import { TimerFAB } from "@/components/recipe-detail/timer-fab";
import { useAuth } from "@/context/auth-context";
import { mapRecipeToMediaItems } from "@/lib/recipes/map-recipe-to-media-items";
import { mapRecipeToSteps } from "@/lib/recipes/map-recipe-to-steps";
import { useThemeColor } from "heroui-native";

import type { RecipeDetailContextValue } from "@norish/shared-react/hooks";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type RecipeDetailViewProps = {
  ctx: RecipeDetailContextValue;
  recipeId: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * The full recipe detail view — only renders when recipe data is loaded.
 * Extracted from the [id] route to keep the page file lean.
 */
export function RecipeDetailView({ ctx, recipeId }: RecipeDetailViewProps) {
  const {
    recipe,
    adjustedIngredients,
    currentServings,
    setIngredientAmounts,
    userRating,
    rateRecipe,
    liked,
    toggleLiked,
  } = ctx;

  const [foregroundColor, mutedColor, backgroundColor] = useThemeColor([
    "foreground",
    "muted",
    "background",
  ] as const);

  const { backendBaseUrl } = useAuth();
  const [cookModeVisible, setCookModeVisible] = useState(false);

  // --- Media items ---
  const mediaItems = useMemo(
    () => mapRecipeToMediaItems(recipe!, backendBaseUrl),
    [recipe, backendBaseUrl]
  );

  // --- Steps ---
  const mappedSteps = useMemo(
    () => mapRecipeToSteps(recipe!, backendBaseUrl),
    [recipe, backendBaseUrl]
  );

  // --- Tags (FullRecipeDTO.tags is { name: string }[], need plain strings) ---
  const tags = useMemo(
    () =>
      (recipe!.tags ?? []).map((tag: string | { name: string }) =>
        typeof tag === "string" ? tag : tag.name
      ),
    [recipe]
  );

  // --- Nutrition ---
  const nutrition = useMemo(
    () => ({
      calories: recipe!.calories,
      fat: recipe!.fat,
      carbs: recipe!.carbs,
      protein: recipe!.protein,
    }),
    [recipe]
  );

  // --- Cook mode ---
  const openCookMode = useCallback(() => setCookModeVisible(true), []);
  const closeCookMode = useCallback(() => setCookModeVisible(false), []);

  return (
    <View style={[styles.root, { backgroundColor }]}>
      <ParallaxScrollView
        headerMedia={
          <RecipeMediaHeader media={mediaItems} liked={liked} onDoubleTapLike={toggleLiked} />
        }
      >
        {/* Tags — above the title, no heading */}
        <RecipeTags tags={tags} />

        {/* Title row with liked button */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: foregroundColor }]}>{recipe!.name}</Text>
          <RecipeLikedButton liked={liked} onToggle={toggleLiked} />
        </View>

        {/* Author — directly under the title */}
        <RecipeAuthor author={recipe!.author} />

        {/* Cook + Plan quick actions */}
        <RecipeQuickActions onCook={openCookMode} />

        {/* Description — SmartText renders bold, italic, links, etc. */}
        {recipe!.description ? (
          <SmartText style={[styles.description, { color: mutedColor }]}>
            {recipe!.description}
          </SmartText>
        ) : null}

        {/* Time stats — left aligned with vertical separators */}
        <RecipeHighlights
          prepMinutes={recipe!.prepMinutes}
          cookMinutes={recipe!.cookMinutes}
          totalMinutes={recipe!.totalMinutes}
        />

        {/* Ingredients with servings +/− control */}
        <RecipeIngredients
          ingredients={adjustedIngredients}
          baseServings={recipe!.servings ?? 1}
          servings={currentServings}
          onServingsChange={setIngredientAmounts}
        />

        {/* Steps */}
        <RecipeSteps steps={mappedSteps} recipeId={recipeId} recipeName={recipe!.name} />

        {/* Rating */}
        <RecipeRating recipeId={recipeId} value={userRating} onRate={rateRecipe} />

        {/* Nutrition with portion scaling */}
        <RecipeNutrition nutrition={nutrition} />
      </ParallaxScrollView>

      {/* Floating timer FAB — liquid glass */}
      <TimerFAB />

      {/* Cook Mode — full-screen modal */}
      <CookModeModal
        visible={cookModeVisible}
        onClose={closeCookMode}
        steps={mappedSteps}
        ingredients={adjustedIngredients}
        recipeId={recipeId}
        recipeName={recipe!.name}
        baseServings={recipe!.servings ?? 1}
        servings={currentServings}
        onServingsChange={setIngredientAmounts}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    flex: 1,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 16,
  },
});
