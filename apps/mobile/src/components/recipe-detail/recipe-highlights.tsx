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
      <Text style={[styles.value, { color: foregroundColor }]}>{value}</Text>
      <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
    </View>
  );
}

function VerticalDivider() {
  const separatorColor = useThemeColor('separator');

  return <View style={[styles.divider, { backgroundColor: separatorColor }]} />;
}

type RecipeHighlightsProps = {
  prepMinutes: number;
  cookMinutes: number;
  totalMinutes: number;
};

/**
 * Left-aligned prep/cook/total times with vertical separators between items.
 * Servings are handled separately next to the Ingredients heading.
 */
export function RecipeHighlights({
  prepMinutes,
  cookMinutes,
  totalMinutes,
}: RecipeHighlightsProps) {
  return (
    <View style={styles.container}>
      <HighlightItem label="Prep" value={`${prepMinutes}m`} />
      <VerticalDivider />
      <HighlightItem label="Cook" value={`${cookMinutes}m`} />
      <VerticalDivider />
      <HighlightItem label="Total" value={`${totalMinutes}m`} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  item: {
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
  divider: {
    width: 1,
    height: 28,
    borderRadius: 1,
  },
});
