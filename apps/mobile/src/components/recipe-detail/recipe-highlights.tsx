import { useThemeColor } from 'heroui-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type HighlightItemProps = {
  label: string;
  value: string;
};

function HighlightItem({ label, value }: HighlightItemProps) {
  const [mutedColor, foregroundColor] = useThemeColor([
    'muted',
    'foreground',
  ] as const);

  return (
    <View style={styles.item}>
      <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
      <Text style={[styles.value, { color: foregroundColor }]}>{value}</Text>
    </View>
  );
}

type RecipeHighlightsProps = {
  prepMinutes: number;
  cookMinutes: number;
  totalMinutes: number;
  servings: number;
};

export function RecipeHighlights({
  prepMinutes,
  cookMinutes,
  totalMinutes,
  servings,
}: RecipeHighlightsProps) {
  return (
    <View style={styles.container}>
      <HighlightItem label="Prep" value={`${prepMinutes}m`} />
      <HighlightItem label="Cook" value={`${cookMinutes}m`} />
      <HighlightItem label="Total" value={`${totalMinutes}m`} />
      <HighlightItem label="Servings" value={`${servings}`} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  item: {
    alignItems: 'center',
    gap: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
});
