import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { GlassBackButton } from "@/components/recipe-detail/glass-back-button";
import { RecipeActionsMenu } from "@/components/recipe-detail/recipe-actions-menu";
import { RecipeDetailSkeleton } from "@/components/recipe-detail/recipe-detail-skeleton";
import { RecipeDetailView } from "@/components/recipe-detail/recipe-detail-view";
import { RecipeDetailProvider, useRecipeContext } from "@/context/recipe-detail-context";
import { Stack, useLocalSearchParams } from "expo-router";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

/**
 * Recipe detail screen with parallax hero image, liquid-glass header buttons,
 * and native iOS feel.
 *
 * Uses RecipeDetailProvider for live backend data with real-time subscriptions.
 */
export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return <RecipeNotFound />;
  }

  return (
    <RecipeDetailProvider recipeId={id}>
      <RecipeDetailContent recipeId={id} />
    </RecipeDetailProvider>
  );
}

// ---------------------------------------------------------------------------
// Inner component — consumes the recipe context
// ---------------------------------------------------------------------------

function RecipeDetailContent({ recipeId }: { recipeId: string }) {
  const ctx = useRecipeContext();

  if (!ctx || ctx.isLoading) {
    return <RecipeDetailSkeleton />;
  }

  if (ctx.isNotFound || !ctx.recipe) {
    return <RecipeNotFound />;
  }

  return (
    <View style={styles.root}>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: "",
          headerShadowVisible: false,
          headerLargeTitle: false,
          headerBackVisible: false,
          headerLeft: () => <GlassBackButton />,
          headerRight: () => <RecipeActionsMenu ctx={ctx} />,
        }}
      />
      <RecipeDetailView ctx={ctx} recipeId={recipeId} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Not-found state
// ---------------------------------------------------------------------------

function RecipeNotFound() {
  const intl = useIntl();
  const [foregroundColor, mutedColor, backgroundColor] = useThemeColor([
    "foreground",
    "muted",
    "background",
  ] as const);

  return (
    <View style={[styles.root, styles.centered, { backgroundColor }]}>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: "",
          headerShadowVisible: false,
          headerBackVisible: false,
          headerLeft: () => <GlassBackButton />,
        }}
      />
      <Text style={[styles.notFoundTitle, { color: foregroundColor }]}>
        {intl.formatMessage({ id: "recipes.detail.notFound" })}
      </Text>
      <Text style={[styles.notFoundSub, { color: mutedColor }]}>
        {intl.formatMessage({ id: "recipes.detail.notFoundMessage" })}
      </Text>
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
  centered: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  notFoundTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  notFoundSub: {
    fontSize: 15,
    textAlign: "center",
  },
});
