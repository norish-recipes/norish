import React from "react";
import { StyleSheet, View } from "react-native";
import { Stack } from "expo-router";
import { Skeleton, SkeletonGroup, useThemeColor } from "heroui-native";

import { GlassBackButton } from "./glass-back-button";

/**
 * Skeleton loading placeholder for the recipe detail page.
 * Mirrors the layout of the actual recipe content with shimmer animations.
 */
export function RecipeDetailSkeleton() {
  const backgroundColor = useThemeColor("background");

  return (
    <View style={[styles.root, { backgroundColor }]}>
      <Stack.Screen
        options={{
          headerTransparent: true,
          headerTitle: "",
          headerShadowVisible: false,
          headerBackVisible: false,
          headerLeft: () => <GlassBackButton />,
        }}
      />

      <SkeletonGroup isLoading isSkeletonOnly>
        {/* Hero image placeholder */}
        <SkeletonGroup.Item className="w-full rounded-none" style={styles.heroImage} />

        {/* Content area */}
        <View style={styles.content}>
          {/* Tags */}
          <View className="mb-3 flex-row gap-2">
            <SkeletonGroup.Item className="h-6 w-20 rounded-full" />
            <SkeletonGroup.Item className="h-6 w-24 rounded-full" />
            <SkeletonGroup.Item className="h-6 w-16 rounded-full" />
          </View>

          {/* Title row */}
          <View className="mb-2 flex-row items-start gap-3">
            <View className="flex-1 gap-1.5">
              <SkeletonGroup.Item className="h-7 w-4/5 rounded-md" />
              <SkeletonGroup.Item className="h-7 w-1/2 rounded-md" />
            </View>
            <SkeletonGroup.Item className="size-7 rounded-full" />
          </View>

          {/* Author */}
          <View className="mb-5 flex-row items-center gap-2">
            <SkeletonGroup.Item className="size-8 rounded-full" />
            <SkeletonGroup.Item className="h-4 w-32 rounded-md" />
          </View>

          {/* Quick actions */}
          <View className="mb-5 flex-row gap-2">
            <SkeletonGroup.Item className="h-12 w-24 rounded-[14px]" />
            <SkeletonGroup.Item className="h-12 w-20 rounded-[14px]" />
            <SkeletonGroup.Item className="size-12 rounded-[14px]" />
          </View>

          {/* Description */}
          <View className="mb-4 gap-1.5">
            <SkeletonGroup.Item className="h-4 w-full rounded-md" />
            <SkeletonGroup.Item className="h-4 w-full rounded-md" />
            <SkeletonGroup.Item className="h-4 w-3/4 rounded-md" />
          </View>

          {/* Highlights / time stats */}
          <View className="mb-6 flex-row items-center gap-4">
            <View className="gap-1">
              <SkeletonGroup.Item className="h-5 w-10 rounded-sm" />
              <SkeletonGroup.Item className="h-3.5 w-8 rounded-sm" />
            </View>
            <View className="gap-1">
              <SkeletonGroup.Item className="h-5 w-10 rounded-sm" />
              <SkeletonGroup.Item className="h-3.5 w-8 rounded-sm" />
            </View>
            <View className="gap-1">
              <SkeletonGroup.Item className="h-5 w-12 rounded-sm" />
              <SkeletonGroup.Item className="h-3.5 w-8 rounded-sm" />
            </View>
          </View>

          {/* Ingredients heading + servings */}
          <View className="mb-3 flex-row items-center justify-between">
            <SkeletonGroup.Item className="h-6 w-28 rounded-md" />
            <View className="flex-row items-center gap-2">
              <SkeletonGroup.Item className="size-7 rounded-lg" />
              <SkeletonGroup.Item className="h-5 w-6 rounded-sm" />
              <SkeletonGroup.Item className="size-7 rounded-lg" />
            </View>
          </View>

          {/* Ingredient rows */}
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} className="mb-3 flex-row items-center justify-between">
              <SkeletonGroup.Item
                className="h-4 rounded-md"
                style={{ width: 120 + (i % 3) * 40 }}
              />
              <SkeletonGroup.Item className="h-4 w-16 rounded-md" />
            </View>
          ))}
        </View>
      </SkeletonGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  heroImage: {
    height: "45%",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    marginTop: -100,
  },
});
