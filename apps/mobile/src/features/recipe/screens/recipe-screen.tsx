import React from "react";
import { ScrollView, View } from "react-native";
import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Skeleton, useThemeColor } from "heroui-native";

import { useDevicePreference, useHiddenItemVisibility } from "@norish/shared-react/reader";
import {
  useAutoConversion,
  useFavoritesMutation,
  useLoadedPageRecipe,
  useRecipeQuery,
} from "@norish/shared-react/recipes";

import { CookbooksSection } from "../components/cookbooks-section";
import { PrefetchIngredientIcons } from "../components/ingredient-icon-prefetch";
import { IngredientsSection } from "../components/ingredients-section";
import { NotesSection } from "../components/notes-section";
import { NutritionSection } from "../components/nutrition-section";
import { ProvenanceSection } from "../components/provenance-section";
import { RatingSection } from "../components/rating-section";
import { RecipeHeader } from "../components/recipe-header";
import { HERO_HEIGHT, RecipeHero } from "../components/recipe-hero";
import { isRecipeNotFound, RecipeNotFound } from "../components/recipe-not-found";
import { RecipeToolbar } from "../components/recipe-toolbar";
import { SourceSection } from "../components/source-section";
import { StepsSection } from "../components/steps-section";
import { TintContext } from "../components/tint";
import { useRecipeHeaderItems } from "../hooks/use-recipe-menu";
import { dishTint } from "../utils/dish-tint";

function RecipeSkeleton() {
  return (
    <View className="bg-background flex-1" testID="recipe-skeleton">
      <Skeleton className="w-full rounded-none" style={{ height: HERO_HEIGHT - 48 }} />
      <View className="items-center gap-3 px-5 pt-4">
        <Skeleton className="h-[38px] w-64 rounded-lg" />
        <Skeleton className="h-[52px] w-full rounded-full" />
        <Skeleton className="h-60 w-full rounded-3xl" />
      </View>
    </View>
  );
}

/** The recipe read from the Warm Set or the server, sections in the order the board sets. */
function RecipePage() {
  const recipe = useLoadedPageRecipe();
  const scheme = useResolvedColorScheme();
  const [colorMode] = useDevicePreference("recipePageColor");
  const { showFavorites } = useHiddenItemVisibility();
  const { toggleFavorite } = useFavoritesMutation();
  const [background] = useThemeColor(["background"] as const);
  const headerItems = useRecipeHeaderItems();
  const tint = colorMode === "dish" ? dishTint(recipe.dishColor, scheme) : null;

  useAutoConversion();

  return (
    <TintContext value={tint}>
      {/* The page's lines and the steps' chips name the same foods, so one read covers them. */}
      <PrefetchIngredientIcons ids={recipe.recipeIngredients.map((line) => line.ingredientId)} />
      <Stack.Screen
        options={{
          // The header floats over the photo: its items stay pinned, with no bar or title behind them.
          scrollEdgeEffects: { top: "hidden" },
          unstable_headerRightItems: () => headerItems,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: tint?.page ?? background }}
        testID="recipe-screen"
      >
        <RecipeHero
          pageColor={tint?.page ?? background}
          recipe={recipe}
          onDoubleTap={showFavorites ? () => toggleFavorite(recipe.id) : undefined}
        />
        <View className="-mt-12 gap-4 pb-32">
          <RecipeHeader recipe={recipe} />
          <View className="gap-4 px-5">
            <NotesSection />
            <IngredientsSection />
            <StepsSection />
            <RatingSection />
            <CookbooksSection />
            <NutritionSection />
            <ProvenanceSection />
            <SourceSection />
          </View>
        </View>
      </ScrollView>
      <RecipeToolbar recipeId={recipe.id} />
    </TintContext>
  );
}

export function RecipeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipe, error } = useRecipeQuery(id);
  const page =
    !recipe && isRecipeNotFound(error) ? (
      <RecipeNotFound />
    ) : recipe ? (
      <RecipePage key={recipe.id} />
    ) : (
      <RecipeSkeleton />
    );

  // Back in every state, a missing recipe too; the stack's anchor puts the list under a link.
  return (
    <>
      <Stack.Screen
        options={{
          unstable_headerLeftItems: () => [
            {
              type: "button",
              label: "",
              icon: { type: "sfSymbol", name: "chevron.left" },
              identifier: "recipe-back",
              onPress: () => router.back(),
            },
          ],
        }}
      />
      {page}
    </>
  );
}
