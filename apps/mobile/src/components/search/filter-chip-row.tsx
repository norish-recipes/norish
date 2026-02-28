import { useThemeColor } from 'heroui-native';
import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { SearchFilters } from '@/lib/recipes/search-filters';
import { FILTER_PRESETS } from '@/lib/recipes/search-filters';

interface FilterChipRowProps {
  filters: SearchFilters;
  onFiltersChange: (filters: SearchFilters) => void;
}

export function FilterChipRow({ filters, onFiltersChange }: FilterChipRowProps) {
  const [accentColor, foregroundColor, surfaceColor, separatorColor] = useThemeColor([
    'accent',
    'foreground',
    'surface',
    'separator',
  ] as const);

  const handlePresetPress = useCallback(
    (presetId: string) => {
      const preset = FILTER_PRESETS.find((p) => p.id === presetId);
      if (!preset) return;
      onFiltersChange(preset.apply(filters));
    },
    [filters, onFiltersChange],
  );

  return (
    <View style={[styles.container, { borderBottomColor: separatorColor }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {FILTER_PRESETS.map((preset) => {
          const active = preset.isActive(filters);
          return (
            <Pressable
              key={preset.id}
              onPress={() => handlePresetPress(preset.id)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: active ? accentColor : surfaceColor,
                  borderColor: active ? accentColor : separatorColor,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipLabel,
                  { color: active ? '#ffffff' : foregroundColor },
                ]}
                numberOfLines={1}
              >
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
