import type { PlannedMeal } from "@/lib/meals/planned-meal.types";
import React from "react";
import { ScrollView, Text, View } from "react-native";
import { styles } from "@/styles/todays-meals-section.styles";
import { Image } from "expo-image";
import { PressableFeedback, useThemeColor } from "heroui-native";

type MealSlotCardProps = {
  meal: PlannedMeal;
  onPress: () => void;
};

function MealSlotCard({ meal, onPress }: MealSlotCardProps) {
  const [backgroundColor, textColor, mutedColor] = useThemeColor([
    "surface-secondary",
    "foreground",
    "muted",
  ] as const);

  if (meal.recipeId !== null) {
    return (
      <PressableFeedback onPress={onPress} style={[styles.slotCard, { backgroundColor }]}>
        <PressableFeedback.Ripple />
        <View style={styles.slotImageContainer}>
          <Image
            source={{ uri: meal.imageUrl ?? undefined }}
            contentFit="cover"
            transition={300}
            style={styles.slotImageFill}
          />
        </View>
        <View style={styles.slotBody}>
          <Text style={[styles.slotLabel, { color: mutedColor }]}>{meal.slot}</Text>
          <Text style={[styles.slotTitle, { color: textColor }]} numberOfLines={1}>
            {meal.recipeTitle}
          </Text>
        </View>
      </PressableFeedback>
    );
  }

  return (
    <PressableFeedback onPress={onPress} style={[styles.slotCard, { backgroundColor }]}>
      <PressableFeedback.Ripple />
      <View style={styles.emptyBody}>
        <Text style={[styles.addIcon, { color: mutedColor }]}>+</Text>
        <Text style={[styles.emptyLabel, { color: mutedColor }]}>{meal.slot}</Text>
      </View>
    </PressableFeedback>
  );
}

type TodaysMealsSectionProps = {
  meals: PlannedMeal[];
};

export function TodaysMealsSection({ meals }: TodaysMealsSectionProps) {
  return (
    <View style={styles.section}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        nestedScrollEnabled
        contentContainerStyle={styles.scrollContent}
      >
        {meals.map((meal) => (
          <MealSlotCard
            key={meal.slot}
            meal={meal}
            onPress={() => {
              // TODO: navigate to meal slot detail / recipe
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}
