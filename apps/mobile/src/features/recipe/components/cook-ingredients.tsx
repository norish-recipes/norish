import React from "react";
import { ScrollView, Text, View } from "react-native";
import { IngredientIconSlots } from "@/components/ingredient-icon";
import { useIntl } from "react-intl";

import {
  formatServings,
  useAmountDisplayPreference,
  useLoadedPageRecipe,
  usePageIngredients,
  usePageServings,
  useUnitFormatter,
} from "@norish/shared-react/recipes";
import { formatAmount } from "@norish/shared/lib/format-amount";

import { ingredientRows } from "../utils/recipe-rows";
import { Line, OptionsMenu, ServingsControl } from "./ingredients-section";

/** The recipe's lines at the page's servings, large and tickable for this Cooking Session. */
export function CookIngredients({
  checked,
  onCheckedChange,
}: {
  checked: ReadonlySet<number>;
  onCheckedChange: (checked: ReadonlySet<number>) => void;
}) {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const servings = usePageServings();
  const display = usePageIngredients();
  const { mode } = useAmountDisplayPreference();
  const { formatUnitOnly } = useUnitFormatter(intl.locale);
  const toggle = (index: number) => {
    const next = new Set(checked);

    if (!next.delete(index)) next.add(index);
    onCheckedChange(next);
  };

  const rows = ingredientRows(display, recipe.systemUsed);

  return (
    <IngredientIconSlots rows={rows}>
      <ScrollView
        contentContainerClassName="px-5 pt-6 pb-48"
        showsVerticalScrollIndicator={false}
        testID="cook-ingredients"
      >
        <View className="flex-row items-baseline justify-between">
          <Text className="text-foreground text-[28px] font-semibold tracking-[-0.6px]">
            {intl.formatMessage({ id: "recipes.cookMode.ingredients" })}
          </Text>
          {recipe.servings ? (
            <Text className="text-muted text-base">
              {intl.formatMessage(
                { id: "recipes.cookMode.serving" },
                { count: formatServings(servings) }
              )}
            </Text>
          ) : null}
        </View>
        <View className="mt-3.5 mb-1.5 flex-row items-center justify-between">
          {recipe.servings ? <ServingsControl /> : <View />}
          <OptionsMenu />
        </View>
        {rows.map((row) =>
          row.kind === "heading" ? (
            <Text
              key={row.key}
              className="text-muted border-separator border-t pt-[18px] pb-2 text-[15px] font-semibold"
            >
              {row.text}
            </Text>
          ) : (
            <Line
              key={row.key}
              large
              amount={formatAmount(row.line.amount, mode)}
              checked={checked.has(row.index)}
              index={row.index}
              foodId={row.foodId}
              name={row.line.ingredientName}
              unit={row.line.unit ? formatUnitOnly(row.line.unit, row.line.amount) : ""}
              onToggle={toggle}
            />
          )
        )}
      </ScrollView>
    </IngredientIconSlots>
  );
}
