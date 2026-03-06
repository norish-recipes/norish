import { Separator, useThemeColor } from 'heroui-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { DummyIngredient } from './dummy-data';

type RecipeIngredientsProps = {
  ingredients: DummyIngredient[];
};

export function RecipeIngredients({ ingredients }: RecipeIngredientsProps) {
  const [foregroundColor, mutedColor] = useThemeColor([
    'foreground',
    'muted',
  ] as const);

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: foregroundColor }]}>
        Ingredients
      </Text>
      {ingredients.map((item, index) => (
        <React.Fragment key={`${item.name}-${index}`}>
          <View style={styles.row}>
            <Text style={[styles.name, { color: foregroundColor }]}>
              {item.name}
            </Text>
            <Text style={[styles.amount, { color: mutedColor }]}>
              {[item.amount, item.unit].filter(Boolean).join(' ')}
            </Text>
          </View>
          {index < ingredients.length - 1 && <Separator />}
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  name: {
    fontSize: 16,
    flex: 1,
  },
  amount: {
    fontSize: 14,
  },
});
