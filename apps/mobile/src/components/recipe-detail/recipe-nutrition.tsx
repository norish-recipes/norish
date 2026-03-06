import { useThemeColor } from 'heroui-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DummyNutrition } from './dummy-data';

type RecipeNutritionProps = {
  nutrition: DummyNutrition;
};

export function RecipeNutrition({ nutrition }: RecipeNutritionProps) {
  const [foregroundColor, mutedColor, surfaceSecondaryColor] = useThemeColor([
    'foreground',
    'muted',
    'surface-secondary',
  ] as const);

  const items = [
    { label: 'Calories', value: `${nutrition.calories}`, unit: 'kcal' },
    { label: 'Protein', value: `${nutrition.protein}`, unit: 'g' },
    { label: 'Carbs', value: `${nutrition.carbs}`, unit: 'g' },
    { label: 'Fat', value: `${nutrition.fat}`, unit: 'g' },
    { label: 'Fiber', value: `${nutrition.fiber}`, unit: 'g' },
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: foregroundColor }]}>Nutrition</Text>
      <View
        style={[styles.grid, { backgroundColor: surfaceSecondaryColor }]}
      >
        {items.map((item) => (
          <View key={item.label} style={styles.item}>
            <Text style={[styles.value, { color: foregroundColor }]}>
              {item.value}
              <Text style={[styles.unit, { color: mutedColor }]}>
                {' '}
                {item.unit}
              </Text>
            </Text>
            <Text style={[styles.label, { color: mutedColor }]}>
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-between',
  },
  item: {
    alignItems: 'center',
    minWidth: 56,
  },
  value: {
    fontSize: 18,
    fontWeight: '700',
  },
  unit: {
    fontSize: 12,
    fontWeight: '400',
  },
  label: {
    fontSize: 12,
    marginTop: 2,
  },
});
