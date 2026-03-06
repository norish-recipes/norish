import { Image } from 'expo-image';
import { Stack } from 'expo-router';
import { useThemeColor } from 'heroui-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DUMMY_RECIPE } from '@/components/recipe-detail/dummy-data';
import { GlassBackButton } from '@/components/recipe-detail/glass-back-button';
import { ParallaxScrollView } from '@/components/recipe-detail/parallax-scroll-view';
import { RecipeActionBar } from '@/components/recipe-detail/recipe-action-bar';
import { RecipeActionsMenu } from '@/components/recipe-detail/recipe-actions-menu';
import { RecipeAuthor } from '@/components/recipe-detail/recipe-author';
import { RecipeHighlights } from '@/components/recipe-detail/recipe-highlights';
import { RecipeIngredients } from '@/components/recipe-detail/recipe-ingredients';
import { RecipeNutrition } from '@/components/recipe-detail/recipe-nutrition';
import { RecipeSteps } from '@/components/recipe-detail/recipe-steps';
import { RecipeTags } from '@/components/recipe-detail/recipe-tags';

/**
 * Recipe detail screen with parallax hero image, liquid-glass header buttons,
 * and a sticky glass action bar at the bottom.
 *
 * Currently uses dummy data — will be wired to the backend later.
 */
export default function RecipeDetailScreen() {
  const recipe = DUMMY_RECIPE;
  const [foregroundColor, mutedColor] = useThemeColor([
    'foreground',
    'muted',
  ] as const);

  return (
    <View style={styles.root}>
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
        headerImage={
          <Image
            source={{ uri: recipe.imageUrl }}
            contentFit="cover"
            transition={400}
            style={StyleSheet.absoluteFill}
          />
        }
      >
        {/* Title + Description */}
        <Text style={[styles.title, { color: foregroundColor }]}>
          {recipe.name}
        </Text>
        <Text style={[styles.description, { color: mutedColor }]}>
          {recipe.description}
        </Text>

        {/* Author */}
        <RecipeAuthor
          name={recipe.source}
          initials={recipe.sourceInitials}
        />

        {/* Quick stats */}
        <RecipeHighlights
          prepMinutes={recipe.prepMinutes}
          cookMinutes={recipe.cookMinutes}
          totalMinutes={recipe.totalMinutes}
          servings={recipe.servings}
        />

        {/* Tags */}
        <RecipeTags tags={recipe.tags} />

        {/* Ingredients */}
        <RecipeIngredients ingredients={recipe.ingredients} />

        {/* Steps */}
        <RecipeSteps steps={recipe.steps} />

        {/* Nutrition */}
        <RecipeNutrition nutrition={recipe.nutrition} />
      </ParallaxScrollView>

      {/* Sticky bottom action bar with glass effect */}
      <RecipeActionBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 16,
  },
});
