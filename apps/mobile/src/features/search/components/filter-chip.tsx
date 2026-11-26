import React from "react";
import { Text } from "react-native";
import { Ionicons } from "@/components/icon";
import { IngredientIcon } from "@/components/ingredient-icon";
import { PressableScale } from "@/components/pressable-scale";
import { useCategoryLabel } from "@/hooks/use-category-label";
import { useTokenColor } from "@/hooks/use-token-color";
import { Skeleton } from "heroui-native";
import { useIntl } from "react-intl";

import { useIngredientName } from "@norish/shared-react/ingredients";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import type { FilterChip } from "../utils/search-chips";
import { chipIcon, chipKey, chipLabel } from "../utils/search-chips";

/** One applied filter; × removes it. An Ingredient's name shows a placeholder until a read names it. */
export function FilterChipView({ chip, onRemove }: { chip: FilterChip; onRemove: () => void }) {
  const intl = useIntl();
  const category = useCategoryLabel();
  const muted = useTokenColor("muted");
  const food = useIngredientName(chip.kind === "ingredient" ? chip.value : null);
  const name = food && ingredientDisplayName(food, intl.locale);
  const unnamed = chip.kind === "ingredient" && name === undefined;
  const label = chipLabel(chip, {
    say: (id, values) => intl.formatMessage({ id }, values),
    category,
    ingredient: () => name ?? "",
  });
  const icon = chipIcon(chip);

  return (
    <PressableScale
      accessibilityLabel={intl.formatMessage(
        { id: "recipes.search.removeFilter" },
        { filter: unnamed ? intl.formatMessage({ id: "recipes.search.ingredientFilter" }) : label }
      )}
      accessibilityRole="button"
      className="bg-default h-9 flex-none flex-row items-center gap-1.5 rounded-full pr-2.5 pl-3.5"
      testID={`search-chip-${chipKey(chip)}`}
      onPress={onRemove}
    >
      {icon ? <IngredientIcon ingredientId={icon} size={20} /> : null}
      {unnamed ? (
        <Skeleton className="h-4 w-16 rounded-md" />
      ) : (
        <Text className="text-foreground text-[15px] font-medium">{label}</Text>
      )}
      <Ionicons color={muted} name="close" size={14} />
    </PressableScale>
  );
}
