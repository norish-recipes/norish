import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

type HighlightItemProps = {
  label: string;
  value: string;
};

function HighlightItem({ label, value }: HighlightItemProps) {
  const [mutedColor, foregroundColor] = useThemeColor(["muted", "foreground"] as const);

  return (
    <View style={styles.item}>
      <Text style={[styles.value, { color: foregroundColor }]}>{value}</Text>
      <Text style={[styles.label, { color: mutedColor }]}>{label}</Text>
    </View>
  );
}

function VerticalDivider() {
  const separatorColor = useThemeColor("separator");

  return <View style={[styles.divider, { backgroundColor: separatorColor }]} />;
}

type RecipeHighlightsProps = {
  prepMinutes: number | null | undefined;
  cookMinutes: number | null | undefined;
  totalMinutes: number | null | undefined;
};

/**
 * Left-aligned prep/cook/total times with vertical separators between items.
 * Servings are handled separately next to the Ingredients heading.
 * Only renders items that have values.
 */
export function RecipeHighlights({
  prepMinutes,
  cookMinutes,
  totalMinutes,
}: RecipeHighlightsProps) {
  const intl = useIntl();
  const items: { label: string; value: string }[] = [];

  if (prepMinutes != null)
    items.push({
      label: intl.formatMessage({ id: "recipes.timeInputs.prep" }),
      value: `${prepMinutes}m`,
    });
  if (cookMinutes != null)
    items.push({
      label: intl.formatMessage({ id: "recipes.timeInputs.cook" }),
      value: `${cookMinutes}m`,
    });
  if (totalMinutes != null)
    items.push({
      label: intl.formatMessage({ id: "recipes.timeInputs.total" }),
      value: `${totalMinutes}m`,
    });

  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      {items.map((item, index) => (
        <React.Fragment key={item.label}>
          {index > 0 && <VerticalDivider />}
          <HighlightItem label={item.label} value={item.value} />
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 24,
  },
  item: {
    gap: 2,
  },
  label: {
    fontSize: 13,
    fontWeight: "500",
  },
  value: {
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    width: 1,
    height: 28,
    borderRadius: 1,
  },
});
