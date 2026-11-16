import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { AnimatedNumber } from "@/components/animated-number";
import { GlassStepper } from "@/components/glass-stepper";
import { IngredientIcon, IngredientIconSlots } from "@/components/ingredient-icon";
import { RoundTick } from "@/components/round-tick";
import { useCardActions } from "@/hooks/use-card-actions";
import { lightImpact } from "@/lib/haptics";
import { useFadeTo } from "@/lib/motion/fade-to";
import { recipeRoute } from "@/lib/tab-routes";
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
import { InlineMarkdown } from "./inline-markdown";
import { SectionCard } from "./tint";

/** The servings stepper; the number opens the Servings sheet. */
export function ServingsControl() {
  const intl = useIntl();
  const router = useRouter();
  const recipe = useLoadedPageRecipe();
  const servings = usePageServings();
  const setServings = useRecipePageStore((state) => state.setServings);

  return (
    <GlassStepper
      decreaseLabelId="recipes.detail.decreaseServings"
      increaseLabelId="recipes.detail.increaseServings"
      testID="recipe-servings"
      onDecrement={() => setServings(servingsDown(servings))}
      onIncrement={() => setServings(servingsUp(servings))}
    >
      <Pressable
        accessibilityLabel={intl.formatMessage(
          { id: "recipes.detail.servingsCount" },
          { count: servings }
        )}
        accessibilityRole="button"
        className="min-w-8 items-center py-2"
        testID="recipe-servings-value"
        onPress={() => router.push(recipeRoute(recipe.id, "servings"))}
      >
        <AnimatedNumber
          className="text-foreground text-base font-semibold"
          value={formatServings(servings)}
        />
      </Pressable>
    </GlassStepper>
  );
}

/** Fractions or decimals, and the measurement system: what changes how the lines read. */
export function OptionsMenu() {
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

/** One ingredient line that ticks; `large` is cook mode's, read from across the counter. */
export function Line({
  index,
  amount,
  unit,
  name,
  ingredientId,
  checked,
  onToggle,
  large = false,
}: {
  index: number;
  amount: string;
  unit: string;
  name: string;
  ingredientId: string | null | undefined;
  checked: boolean;
  onToggle: (index: number) => void;
  large?: boolean;
}) {
  const plain = plainText(name);
  const fade = useFadeTo(checked ? 0.5 : 1);

  return (
    <Pressable
      accessibilityLabel={[amount, unit, plain].filter(Boolean).join(" ")}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      testID={`recipe-ingredient-${index}`}
      onPress={() => {
        lightImpact();
        onToggle(index);
      }}
    >
      <Animated.View
        className={`border-separator flex-row items-center border-t ${large ? "gap-3 py-3" : "gap-2.5 py-2"}`}
        style={fade}
      >
        <RoundTick selected={checked} />
        <IngredientIcon
          ingredientId={namesNoFood(name) ? null : ingredientId}
          size={large ? 34 : undefined}
        />
        <View className="min-w-0 flex-1 flex-row items-baseline gap-1">
          {amount ? (
            <AnimatedNumber
              className={`${large ? "text-xl leading-[26px]" : "text-base leading-[22px]"} font-semibold ${checked ? "text-muted line-through" : "text-foreground"}`}
              value={amount}
            />
          ) : null}
          <Text
            className={`min-w-0 flex-1 ${large ? "text-xl leading-[26px]" : "text-base leading-[22px]"} ${checked ? "text-muted line-through" : "text-foreground"}`}
          >
            {unit ? <Text className="text-accent-text font-semibold">{`${unit} `}</Text> : null}
            <InlineMarkdown disableLinks={checked} text={name} />
          </Text>
        </View>
      </Animated.View>
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
    <IngredientIconSlots ids={display.map((line) => line.ingredientId)}>
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
    </IngredientIconSlots>
  );
}
