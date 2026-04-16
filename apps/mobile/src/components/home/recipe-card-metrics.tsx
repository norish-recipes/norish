import type { RecipeCardItem } from "@/lib/recipes/recipe-card.types";
import React from "react";
import { Text, View } from "react-native";
import { styles } from "@/styles/recipe-card.styles";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

function formatDuration(totalDurationMinutes: number) {
  if (totalDurationMinutes < 60) {
    return `${totalDurationMinutes}m`;
  }
  const hours = Math.floor(totalDurationMinutes / 60);
  const minutes = totalDurationMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function HighlightItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}) {
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <View style={styles.highlightItem}>
      <Text style={styles.highlightLabel} className="text-foreground/70">
        {label}
      </Text>
      <View style={styles.metricRow}>
        {icon ? <Ionicons name={icon} size={12} color={muted} /> : null}
        <Text style={styles.highlightValue} className="text-foreground">
          {value}
        </Text>
      </View>
    </View>
  );
}

function RatingHighlight({ rating, starColor }: { rating: number; starColor: string }) {
  return (
    <View style={styles.highlightItem}>
      <Text style={styles.highlightLabel} className="text-foreground/70">
        Rating
      </Text>
      <View style={styles.ratingRow}>
        <Text style={[styles.highlightValue, { color: starColor }]}>★</Text>
        <Text style={styles.highlightValue} className="text-foreground">
          {" "}
          {rating.toFixed(1)}
        </Text>
      </View>
    </View>
  );
}

type RecipeCardMetricsProps = {
  recipe: RecipeCardItem;
};

function RecipeCardMetricsComponent({ recipe }: RecipeCardMetricsProps) {
  const intl = useIntl();
  const [warning, divider] = useThemeColor(["warning", "border-secondary"] as const);

  return (
    <View className="mt-1 flex-row items-center gap-3">
      {recipe.rating > 0 && (
        <>
          <RatingHighlight rating={recipe.rating} starColor={warning} />
          <View style={[styles.highlightDivider, { backgroundColor: divider }]} />
        </>
      )}
      <HighlightItem
        label={intl.formatMessage({ id: "recipes.form.servings" })}
        value={String(recipe.servings)}
        icon="people-outline"
      />
      <View style={[styles.highlightDivider, { backgroundColor: divider }]} />
      <HighlightItem
        label={intl.formatMessage({ id: "common.filters.cookingTime" })}
        value={formatDuration(recipe.totalDurationMinutes)}
        icon="time-outline"
      />
    </View>
  );
}

export const RecipeCardMetrics = React.memo(RecipeCardMetricsComponent);
