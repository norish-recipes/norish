import { Stack } from 'expo-router';
import { useThemeColor } from 'heroui-native';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { CookModeModal } from '@/components/recipe-detail/cook-mode';
import { DUMMY_RECIPE } from '@/components/recipe-detail/dummy-data';
import { GlassBackButton } from '@/components/recipe-detail/glass-back-button';
import { ParallaxScrollView } from '@/components/recipe-detail/parallax-scroll-view';
import { RecipeActionsMenu } from '@/components/recipe-detail/recipe-actions-menu';
import { RecipeAuthor } from '@/components/recipe-detail/recipe-author';
import { RecipeHighlights } from '@/components/recipe-detail/recipe-highlights';
import { RecipeIngredients } from '@/components/recipe-detail/recipe-ingredients';
import { RecipeMediaHeader } from '@/components/recipe-detail/recipe-media-header';
import { RecipeNutrition } from '@/components/recipe-detail/recipe-nutrition';
import { RecipeQuickActions } from '@/components/recipe-detail/recipe-quick-actions';
import {
  RecipeLikedButton,
  RecipeRating,
} from '@/components/recipe-detail/recipe-rating';
import { RecipeSteps } from '@/components/recipe-detail/recipe-steps';
import { RecipeTags } from '@/components/recipe-detail/recipe-tags';
import { TimerFAB } from '@/components/recipe-detail/timer-fab';
import { SmartText } from '@/components/recipe-detail/text-renderer';

/**
 * Recipe detail screen with parallax hero image, liquid-glass header buttons,
 * and native iOS feel.
 *
 * Currently uses dummy data — will be wired to the backend later.
 */
export default function RecipeDetailScreen() {
  const recipe = DUMMY_RECIPE;
  const [foregroundColor, mutedColor, backgroundColor] = useThemeColor([
    'foreground',
    'muted',
    'background',
  ] as const);

  const [liked, setLiked] = useState(recipe.liked);
  const [rating, setRating] = useState(recipe.rating);
  const [cookModeVisible, setCookModeVisible] = useState(false);
  const [servings, setServings] = useState(recipe.servings);

  const handleDoubleTapLike = useCallback(() => {
    setLiked((prev) => !prev);
  }, []);

  const openCookMode = useCallback(() => {
    setCookModeVisible(true);
  }, []);

  const closeCookMode = useCallback(() => {
    setCookModeVisible(false);
  }, []);

  return (
    <View style={[styles.root, { backgroundColor }]}>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: '',
          headerShadowVisible: false,
          headerLargeTitle: false,
          headerBackVisible: false,
          headerLeft: () => <GlassBackButton />,
          headerRight: () => <RecipeActionsMenu />,
        }}
      />

      <ParallaxScrollView
        headerMedia={
          <RecipeMediaHeader
            media={recipe.media}
            liked={liked}
            onDoubleTapLike={handleDoubleTapLike}
          />
        }
      >
        {/* Tags — above the title, no heading */}
        <RecipeTags tags={recipe.tags} />

        {/* Title row with liked button */}
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: foregroundColor }]}>
            {recipe.name}
          </Text>
          <RecipeLikedButton
            liked={liked}
            onToggle={() => setLiked((l) => !l)}
          />
        </View>

        {/* Author — directly under the title */}
        <RecipeAuthor
          name={recipe.source}
          initials={recipe.sourceInitials}
        />

        {/* Cook + Plan quick actions */}
        <RecipeQuickActions onCook={openCookMode} />

        {/* Description — SmartText renders bold, italic, links, etc. */}
        <SmartText style={[styles.description, { color: mutedColor }]}>
          {recipe.description}
        </SmartText>

        {/* Time stats — left aligned with vertical separators */}
        <RecipeHighlights
          prepMinutes={recipe.prepMinutes}
          cookMinutes={recipe.cookMinutes}
          totalMinutes={recipe.totalMinutes}
        />

        {/* Ingredients with servings +/− control */}
        <RecipeIngredients
          ingredients={recipe.ingredients}
          baseServings={recipe.servings}
          servings={servings}
          onServingsChange={setServings}
        />

        {/* Steps */}
        <RecipeSteps steps={recipe.steps} recipeId={recipe.id} recipeName={recipe.name} />

        {/* Rating */}
        <RecipeRating value={rating} onRate={setRating} />

        {/* Nutrition with portion scaling */}
        <RecipeNutrition nutrition={recipe.nutrition} />
      </ParallaxScrollView>

      {/* Floating timer FAB — liquid glass */}
      <TimerFAB />

      {/* Cook Mode — full-screen modal */}
      <CookModeModal
        visible={cookModeVisible}
        onClose={closeCookMode}
        steps={recipe.steps}
        ingredients={recipe.ingredients}
        recipeId={recipe.id}
        recipeName={recipe.name}
        baseServings={recipe.servings}
        servings={servings}
        onServingsChange={setServings}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    flex: 1,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 16,
  },
});
