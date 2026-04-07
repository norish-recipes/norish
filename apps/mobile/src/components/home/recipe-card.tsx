import type { RecipeCardItem } from "@/lib/recipes/recipe-card.types";
import React from "react";
import { Text, View } from "react-native";
import { styles } from "@/styles/recipe-card.styles";
import { Ionicons } from "@expo/vector-icons";
import { Card, useThemeColor } from "heroui-native";

import { RecipeCardCategories } from "./recipe-card-categories";
import { RecipeCardImage } from "./recipe-card-image";
import { RecipeCardMetrics } from "./recipe-card-metrics";

type RecipeCardProps = {
  recipe: RecipeCardItem;
  onPress?: () => void;
  onDoubleTapLike?: () => void;
};

function RecipeCardComponent({ recipe, onPress, onDoubleTapLike }: RecipeCardProps) {
  const [surfaceTertiary, separator, danger] = useThemeColor([
    "surface-tertiary",
    "separator",
    "danger",
  ] as const);

  return (
    <Card variant="secondary" className="overflow-hidden rounded-2xl p-0">
      <RecipeCardImage recipe={recipe} onPress={onPress} onDoubleTapLike={onDoubleTapLike} />

      <Card.Body className="gap-1.5 px-3.5 pt-3 pb-3.5">
        <View style={styles.titleRow}>
          <Text style={styles.title} className="text-foreground" numberOfLines={1}>
            {recipe.title}
          </Text>

          {recipe.liked ? (
            <View style={styles.titleHeartBadge}>
              <Ionicons name="heart" size={18} color={danger} />
            </View>
          ) : null}
        </View>

        <RecipeCardCategories
          recipeId={recipe.id}
          categories={recipe.categories}
          chipBackground={surfaceTertiary}
          chipBorder={separator}
        />

        {recipe.description ? (
          <Text style={styles.description} className="text-foreground/70" numberOfLines={2}>
            {recipe.description}
          </Text>
        ) : null}

        <RecipeCardMetrics recipe={recipe} />
      </Card.Body>
    </Card>
  );
}

export const RecipeCard = React.memo(RecipeCardComponent);
