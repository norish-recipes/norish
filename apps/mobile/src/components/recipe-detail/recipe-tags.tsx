import { Chip, useThemeColor } from 'heroui-native';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

type RecipeTagsProps = {
  tags: string[];
};

export function RecipeTags({ tags }: RecipeTagsProps) {
  const foregroundColor = useThemeColor('foreground');

  if (tags.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: foregroundColor }]}>Tags</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tagRow}
      >
        {tags.map((tag) => (
          <Chip key={tag} size="sm" variant="soft" animation="disable-all">
            <Chip.Label>{tag}</Chip.Label>
          </Chip>
        ))}
      </ScrollView>
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
  tagRow: {
    flexDirection: 'row',
    gap: 8,
  },
});
