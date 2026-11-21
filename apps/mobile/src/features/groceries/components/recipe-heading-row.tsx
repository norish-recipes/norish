import React from "react";
import { Text, View } from "react-native";
import { useIntl } from "react-intl";

import type { Heading } from "../utils/list-rows";
import { SectionMenu } from "./section-menu";

type RecipeHeading = Extract<Heading, { type: "recipe" }>;

/** A recipe's heading in the list by recipe: its name and how many lines are left. */
export function RecipeHeadingRow({
  heading,
  onClear,
}: {
  heading: RecipeHeading;
  onClear: () => void;
}) {
  const intl = useIntl();

  return (
    <View className="bg-default h-14 flex-row items-center gap-1 pr-2 pl-4">
      <Text className="text-foreground shrink text-[17px] font-semibold" numberOfLines={1}>
        {heading.name}
      </Text>
      <Text className="text-muted flex-1 pl-1.5 text-sm" numberOfLines={1}>
        {intl.formatMessage({ id: "groceries.item.items" }, { count: heading.open })}
      </Text>
      <SectionMenu
        actions={{ clearAll: onClear }}
        label={intl.formatMessage({ id: "groceries.store.recipeActions" })}
        testID={`recipe-actions-${heading.recipeId ?? "manual"}`}
      />
    </View>
  );
}
