import React from "react";
import { ScrollView, StyleSheet } from "react-native";
import { Chip } from "heroui-native";

type RecipeTagsProps = {
  tags: string[];
};

/**
 * Horizontally scrollable tag chips — rendered above the title without a heading.
 */
export function RecipeTags({ tags }: RecipeTagsProps) {
  if (tags.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.tagRow}
      style={styles.container}
    >
      {tags.map((tag) => (
        <Chip key={tag} size="sm" variant="soft" animation="disable-all">
          <Chip.Label>{tag}</Chip.Label>
        </Chip>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  tagRow: {
    flexDirection: "row",
    gap: 8,
  },
});
