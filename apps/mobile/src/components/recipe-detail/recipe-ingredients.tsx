import Entypo from '@expo/vector-icons/Entypo';
import { Button, Separator, useThemeColor } from 'heroui-native';
import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { withUniwind } from 'uniwind';

import type { DummyIngredient } from './dummy-data';

const StyledEntypo = withUniwind(Entypo);

// ---------------------------------------------------------------------------
// Servings control (matches web ServingsControl pattern)
// ---------------------------------------------------------------------------

function formatServings(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2).replace(/\.?0+$/, '');
}

type ServingsControlProps = {
  servings: number;
  onServingsChange: (s: number) => void;
};

function ServingsControl({ servings, onServingsChange }: ServingsControlProps) {
  const [foregroundColor, mutedColor] = useThemeColor([
    'foreground',
    'muted',
  ] as const);

  const dec = useCallback(() => {
    onServingsChange(
      servings <= 1
        ? Math.max(0.125, servings / 2)
        : servings <= 2
          ? 1
          : servings - 1,
    );
  }, [servings, onServingsChange]);

  const inc = useCallback(() => {
    onServingsChange(servings < 1 ? Math.min(1, servings * 2) : servings + 1);
  }, [servings, onServingsChange]);

  return (
    <View style={styles.servingsRow}>
      <Button
        variant="secondary"
        size="sm"
        isIconOnly
        className="size-7 rounded-lg bg-surface-tertiary"
        onPress={dec}
      >
        <StyledEntypo name="minus" size={14} className="text-foreground" />
      </Button>
      <Text
        style={[styles.servingsValue, { color: foregroundColor }]}
      >
        {formatServings(servings)}
      </Text>
      <Button
        variant="secondary"
        size="sm"
        isIconOnly
        className="size-7 rounded-lg bg-surface-tertiary"
        onPress={inc}
      >
        <StyledEntypo name="plus" size={14} className="text-foreground" />
      </Button>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Ingredients list
// ---------------------------------------------------------------------------

type RecipeIngredientsProps = {
  ingredients: DummyIngredient[];
  baseServings: number;
};

export function RecipeIngredients({
  ingredients,
  baseServings,
}: RecipeIngredientsProps) {
  const [foregroundColor, mutedColor] = useThemeColor([
    'foreground',
    'muted',
  ] as const);
  const [servings, setServings] = useState(baseServings);

  const scale = servings / baseServings;

  return (
    <View style={styles.container}>
      {/* Header row: title + servings control */}
      <View style={styles.headerRow}>
        <Text style={[styles.title, { color: foregroundColor }]}>
          Ingredients
        </Text>
        <ServingsControl servings={servings} onServingsChange={setServings} />
      </View>

      {/* Ingredient rows */}
      {ingredients.map((item, index) => {
        const scaledAmount =
          item.amount && !isNaN(Number(item.amount))
            ? formatServings(Number(item.amount) * scale)
            : item.amount;

        return (
          <React.Fragment key={`${item.name}-${index}`}>
            <View style={styles.row}>
              <Text style={[styles.name, { color: foregroundColor }]}>
                {item.name}
              </Text>
              <Text style={[styles.amount, { color: mutedColor }]}>
                {[scaledAmount, item.unit].filter(Boolean).join(' ')}
              </Text>
            </View>
            {index < ingredients.length - 1 && <Separator />}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  servingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  servingsValue: {
    fontSize: 15,
    fontWeight: '600',
    minWidth: 24,
    textAlign: 'center',
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
