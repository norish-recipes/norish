import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Card, Skeleton, SkeletonGroup, useThemeColor } from "heroui-native";

type RecipeCardSkeletonProps = {
  compact?: boolean;
};

/**
 * Skeleton placeholder that mirrors the RecipeCard layout.
 * Uses SkeletonGroup so all shimmer animations stay in sync.
 */
export function RecipeCardSkeleton({ compact = false }: RecipeCardSkeletonProps) {
  return (
    <Card variant="secondary" className="overflow-hidden rounded-2xl p-0">
      <SkeletonGroup isLoading isSkeletonOnly>
        {/* Image area */}
        <SkeletonGroup.Item
          className="w-full rounded-none"
          style={{ aspectRatio: compact ? 16 / 9 : 16 / 11 }}
        />

        {/* Card body */}
        <View className="gap-2.5 px-3.5 pt-3 pb-3.5">
          {/* Title */}
          <SkeletonGroup.Item className="h-5 w-3/4 rounded-md" />

          {/* Category chips */}
          <View className="flex-row gap-1.5">
            <SkeletonGroup.Item className="h-5 w-16 rounded-full" />
            <SkeletonGroup.Item className="h-5 w-20 rounded-full" />
          </View>

          {/* Description */}
          {!compact && (
            <View className="gap-1">
              <SkeletonGroup.Item className="h-3.5 w-full rounded-md" />
              <SkeletonGroup.Item className="h-3.5 w-2/3 rounded-md" />
            </View>
          )}

          {/* Metrics row */}
          <View className="mt-0.5 flex-row items-center gap-3">
            <View className="gap-1">
              <SkeletonGroup.Item className="h-2.5 w-10 rounded-sm" />
              <SkeletonGroup.Item className="h-4 w-8 rounded-sm" />
            </View>
            <View className="gap-1">
              <SkeletonGroup.Item className="h-2.5 w-12 rounded-sm" />
              <SkeletonGroup.Item className="h-4 w-6 rounded-sm" />
            </View>
            <View className="gap-1">
              <SkeletonGroup.Item className="h-2.5 w-8 rounded-sm" />
              <SkeletonGroup.Item className="h-4 w-10 rounded-sm" />
            </View>
          </View>
        </View>
      </SkeletonGroup>
    </Card>
  );
}

/**
 * Placeholder shown for each recipe that is currently being imported
 * on the backend (pending state).
 */
export function ImportingRecipePlaceholder({ compact = false }: RecipeCardSkeletonProps) {
  const [foregroundColor, mutedColor] = useThemeColor(["foreground", "muted"] as const);

  return (
    <Card variant="secondary" className="overflow-hidden rounded-2xl p-0">
      <SkeletonGroup isLoading>
        {/* Shimmer image area to convey activity */}
        <SkeletonGroup.Item
          className="w-full rounded-none"
          style={{ aspectRatio: compact ? 16 / 9 : 16 / 11 }}
        />

        {/* Info overlay */}
        <Card.Body style={styles.importingBody}>
          <Text style={[styles.importingTitle, { color: foregroundColor }]}>Importing recipe…</Text>
          <Text style={[styles.importingDescription, { color: mutedColor }]}>
            It will appear here as soon as it is ready.
          </Text>
        </Card.Body>
      </SkeletonGroup>
    </Card>
  );
}

const styles = StyleSheet.create({
  importingBody: {
    gap: 4,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  importingTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  importingDescription: {
    fontSize: 13,
    textAlign: "center",
  },
});
