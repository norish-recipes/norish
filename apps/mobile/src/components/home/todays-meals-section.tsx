import { Image } from 'expo-image';
import { useThemeColor } from 'heroui-native';
import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { PlannedMeal } from '@/lib/meals/planned-meal.types';

import { styles } from './todays-meals-section.styles';

type MealSlotCardProps = {
  meal: PlannedMeal;
  onPress: () => void;
};

function MealSlotCard({ meal, onPress }: MealSlotCardProps) {
  const [backgroundColor, textColor, mutedColor] = useThemeColor([
    'surface',
    'foreground',
    'muted',
  ] as const);

  if (meal.recipeId !== null) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.slotCard, { backgroundColor, opacity: pressed ? 0.8 : 1 }]}
      >
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
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.slotCard, { backgroundColor, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={styles.emptyBody}>
        <Text style={[styles.addIcon, { color: mutedColor }]}>+</Text>
        <Text style={[styles.emptyLabel, { color: mutedColor }]}>{meal.slot}</Text>
      </View>
    </Pressable>
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
              console.log('[TodaysMealsSection] pressed slot', meal.slot);
            }}
          />
        ))}
      </ScrollView>
    </View>
  );
}
