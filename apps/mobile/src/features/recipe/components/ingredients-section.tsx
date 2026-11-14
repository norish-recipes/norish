import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { RoundTick } from "@/components/round-tick";
import { useCardActions } from "@/hooks/use-card-actions";
import { Host, Menu, Button as NativeButton } from "@expo/ui/swift-ui";
import { buttonStyle, labelStyle } from "@expo/ui/swift-ui/modifiers";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { Button, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import {
  formatServings,
  servingsDown,
  servingsUp,
  useAmountDisplayPreference,
  useLoadedPageRecipe,
  usePageIngredients,
  usePageServings,
  useRecipePageStore,
  useSystemConversion,
  useUnitFormatter,
} from "@norish/shared-react/recipes";
import { formatAmount } from "@norish/shared/lib/format-amount";
import { namesNoFood } from "@norish/shared/lib/ingredient-text";

import { ingredientRows, plainText } from "../utils/recipe-rows";
import { IngredientIcon } from "./ingredient-icon";
import { InlineMarkdown } from "./inline-markdown";
import { SectionCard, useTint } from "./tint";

function RoundButton({
  icon,
  label,
  testID,
  onPress,
}: {
  icon: "add" | "remove";
  label: string;
  testID: string;
  onPress: () => void;
}) {
  const tint = useTint();
  const [foreground] = useThemeColor(["foreground"] as const);

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      className="bg-default size-9 items-center justify-center rounded-full"
      style={tint ? { backgroundColor: tint.soft } : undefined}
      testID={testID}
      onPress={onPress}
    >
      <Ionicons color={foreground} name={icon} size={17} />
    </Pressable>
  );
}

/** The servings stepper; the number opens the Servings sheet. */
function ServingsControl() {
  const intl = useIntl();
  const router = useRouter();
  const recipe = useLoadedPageRecipe();
  const servings = usePageServings();
  const setServings = useRecipePageStore((state) => state.setServings);

  return (
    <View className="flex-row items-center gap-1">
      <RoundButton
        icon="remove"
        label={intl.formatMessage({ id: "recipes.detail.decreaseServings" })}
        testID="recipe-servings-decrease"
        onPress={() => setServings(servingsDown(servings))}
      />
      <Pressable
        accessibilityLabel={intl.formatMessage(
          { id: "recipes.detail.servingsCount" },
          { count: servings }
        )}
        accessibilityRole="button"
        className="min-w-8 items-center py-2"
        testID="recipe-servings-value"
        onPress={() =>
          router.push({ pathname: "/recipe/[id]/servings", params: { id: recipe.id } })
        }
      >
        <Text className="text-foreground text-base font-semibold">{formatServings(servings)}</Text>
      </Pressable>
      <RoundButton
        icon="add"
        label={intl.formatMessage({ id: "recipes.detail.increaseServings" })}
        testID="recipe-servings-increase"
        onPress={() => setServings(servingsUp(servings))}
      />
    </View>
  );
}

/** Fractions or decimals, and the measurement system: what changes how the lines read. */
function OptionsMenu() {
  const intl = useIntl();
  const { mode, toggleMode } = useAmountDisplayPreference();
  const conversion = useSystemConversion();

  return (
    <View testID="recipe-ingredient-options">
      <Host matchContents>
        <Menu
          label={intl.formatMessage({ id: "recipes.detail.ingredientOptions" })}
          modifiers={[buttonStyle("glass"), labelStyle("iconOnly")]}
          systemImage="slider.horizontal.3"
        >
          <NativeButton
            label={intl.formatMessage({
              id:
                mode === "fraction"
                  ? "recipes.detail.switchToDecimal"
                  : "recipes.detail.switchToFraction",
            })}
            systemImage="plusminus"
            onPress={toggleMode}
          />
          {conversion.isAvailable
            ? conversion.options
                .filter((option) => option.withAI || option.system !== conversion.currentSystem)
                .map((option) => (
                  <NativeButton
                    key={option.key}
                    label={intl.formatMessage({ id: `recipes.convert.${option.labelKey}` })}
                    systemImage={option.withAI ? "sparkles" : "arrow.left.arrow.right"}
                    onPress={() => conversion.convertTo(option)}
                  />
                ))
            : null}
        </Menu>
      </Host>
    </View>
  );
}

function Line({
  index,
  amount,
  unit,
  name,
  ingredientId,
  checked,
  onToggle,
}: {
  index: number;
  amount: string;
  unit: string;
  name: string;
  ingredientId: string | null | undefined;
  checked: boolean;
  onToggle: (index: number) => void;
}) {
  const plain = plainText(name);

  return (
    <Pressable
      accessibilityLabel={[amount, unit, plain].filter(Boolean).join(" ")}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="border-separator flex-row items-center gap-2.5 border-t py-2"
      style={{ opacity: checked ? 0.5 : 1 }}
      testID={`recipe-ingredient-${index}`}
      onPress={() => onToggle(index)}
    >
      <RoundTick selected={checked} />
      {namesNoFood(name) ? null : <IngredientIcon ingredientId={ingredientId} />}
      <Text
        className={`min-w-0 flex-1 text-base leading-[22px] ${checked ? "text-muted line-through" : "text-foreground"}`}
      >
        {amount ? <Text className="font-semibold">{`${amount} `}</Text> : null}
        {unit ? <Text className="text-accent-text font-semibold">{`${unit} `}</Text> : null}
        <InlineMarkdown text={name} />
      </Text>
    </Pressable>
  );
}

/** The Ingredients card: servings, options, ticks, and Add to groceries. */
export function IngredientsSection() {
  const intl = useIntl();
  const actions = useCardActions();
  const recipe = useLoadedPageRecipe();
  const servings = usePageServings();
  const display = usePageIngredients();
  const { mode } = useAmountDisplayPreference();
  const { formatUnitOnly } = useUnitFormatter(intl.locale);
  const [checked, setChecked] = useState<ReadonlySet<number>>(() => new Set());
  const [accentForeground] = useThemeColor(["accent-foreground"] as const);
  const rows = ingredientRows(display, recipe.systemUsed);
  const toggle = (index: number) => {
    const next = new Set(checked);

    if (!next.delete(index)) next.add(index);
    setChecked(next);
  };

  return (
    <SectionCard
      right={
        <View className="flex-row items-center gap-1.5">
          {recipe.servings ? <ServingsControl /> : null}
          <OptionsMenu />
        </View>
      }
      testID="recipe-ingredients"
      title={intl.formatMessage({ id: "recipes.detail.ingredients" })}
    >
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
            amount={formatAmount(row.line.amount, mode)}
            checked={checked.has(row.index)}
            index={row.index}
            ingredientId={row.line.ingredientId}
            name={row.line.ingredientName}
            unit={row.line.unit ? formatUnitOnly(row.line.unit, row.line.amount) : ""}
            onToggle={toggle}
          />
        )
      )}
      <Button
        className="mt-3 rounded-full"
        testID="recipe-add-to-groceries"
        variant="primary"
        onPress={() => actions.addToGroceries(recipe, servings)}
      >
        <Ionicons color={accentForeground} name="bag-outline" size={18} />
        <Button.Label>{intl.formatMessage({ id: "recipes.detail.addToGroceries" })}</Button.Label>
      </Button>
    </SectionCard>
  );
}
