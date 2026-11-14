import React, { useState } from "react";
import { ScrollView, View } from "react-native";
import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Skeleton, useThemeColor } from "heroui-native";

import { useIngredientIcons } from "@norish/shared-react/ingredients";
import { useDevicePreference, useHiddenItemVisibility } from "@norish/shared-react/reader";
import {
  useAutoConversion,
  useFavoritesMutation,
  useLoadedPageRecipe,
  useRecipeQuery,
} from "@norish/shared-react/recipes";

import { CookbooksSection } from "../components/cookbooks-section";
import { IngredientsSection } from "../components/ingredients-section";
import { NotesSection } from "../components/notes-section";
import { NutritionSection } from "../components/nutrition-section";
import { ProvenanceSection } from "../components/provenance-section";
import { RatingSection } from "../components/rating-section";
import { RecipeBottomBar } from "../components/recipe-bottom-bar";
import { RecipeHeader } from "../components/recipe-header";
import { HERO_HEIGHT, RecipeHero } from "../components/recipe-hero";
import { isRecipeNotFound, RecipeNotFound } from "../components/recipe-not-found";
import { SourceSection } from "../components/source-section";
import { StepsSection } from "../components/steps-section";
import { TintContext } from "../components/tint";
import { useRecipeHeaderItems } from "../hooks/use-recipe-menu";
import { dishTint } from "../utils/dish-tint";

/** The scroll offset past which the recipe's name takes the header. */
const TITLE_OFFSET = 330;

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
  const router = useRouter();
  const recipe = useLoadedPageRecipe();
  const scheme = useResolvedColorScheme();
  const [colorMode] = useDevicePreference("recipePageColor");
  const { showFavorites } = useHiddenItemVisibility();
  const { toggleFavorite } = useFavoritesMutation();
  const [background] = useThemeColor(["background"] as const);
  const [scrolled, setScrolled] = useState(false);
  const headerItems = useRecipeHeaderItems();
  const tint = colorMode === "dish" ? dishTint(recipe.dishColor, scheme) : null;

  useAutoConversion();
  // Every surface of the page names the recipe's foods: its lines and the steps' chips.
  useIngredientIcons(recipe.recipeIngredients.map((line) => line.ingredientId));

  return (
    <TintContext value={tint}>
      <Stack.Screen
        options={{
          title: scrolled ? recipe.name : "",
          unstable_headerLeftItems: () => [
            {
              type: "button",
              label: "",
              icon: { type: "sfSymbol", name: "chevron.left" },
              identifier: "recipe-back",
              onPress: () => router.back(),
            },
          ],
          unstable_headerRightItems: () => headerItems,
        }}
      />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        scrollEventThrottle={64}
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: tint?.page ?? background }}
        testID="recipe-screen"
        onScroll={(event) => setScrolled(event.nativeEvent.contentOffset.y > TITLE_OFFSET)}
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
      <RecipeBottomBar page={tint?.page ?? background} recipeId={recipe.id} />
    </TintContext>
  );
}

export function RecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { recipe, error } = useRecipeQuery(id);

  if (!recipe && isRecipeNotFound(error)) return <RecipeNotFound />;

  return recipe ? <RecipePage key={recipe.id} /> : <RecipeSkeleton />;
}
