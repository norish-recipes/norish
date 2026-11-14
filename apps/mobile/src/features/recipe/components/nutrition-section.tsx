import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useHiddenItemVisibility } from "@norish/shared-react/reader";
import {
  useLoadedPageRecipe,
  usePageEnrichment,
  useWorkedOutNutrition,
} from "@norish/shared-react/recipes";
import { macroCalorieShares } from "@norish/shared/lib/nutrition-macros";

import type { NutritionFigures } from "../utils/stored-nutrition";
import { useTokenColor } from "../hooks/use-token-color";
import { plainText } from "../utils/recipe-rows";
import { storedNutrition } from "../utils/stored-nutrition";
import { NutritionDonut } from "./nutrition-donut";
import { SectionCard, useTint } from "./tint";

const MACRO_ICON = {
  fat: "water-outline",
  carbs: "cube-outline",
  protein: "flash-outline",
} as const;

const REASON_KEYS = {
  seasoning: "seasoning",
  "no-amount": "noAmount",
  "no-size": "noSize",
  "no-numbers": "noNumbers",
  "no-spoon-weight": "noSpoonWeight",
  "no-piece-weight": "noPieceWeight",
} as const;

/** Nutrition: stored values, else the total worked out from the lines; portions scale it. */
export function NutritionSection() {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const enrichment = usePageEnrichment();
  const { showNutrition } = useHiddenItemVisibility();
  const workedOut = useWorkedOutNutrition(recipe);
  const [portions, setPortions] = useState(1);
  const [listOpen, setListOpen] = useState(false);
  const [foreground, muted] = useThemeColor(["foreground", "muted"] as const);
  const macroColor = {
    fat: useTokenColor("nutrition-fat"),
    carbs: useTokenColor("nutrition-carbs"),
    protein: useTokenColor("nutrition-protein"),
  };
  const tint = useTint();
  const stored = storedNutrition(recipe);
  const perServing = workedOut?.perServing;
  const shown: NutritionFigures | null =
    stored ??
    (perServing
      ? {
          calories: perServing.calories,
          fat: perServing.fat,
          carbs: perServing.carbs,
          protein: perServing.protein,
        }
      : null);
  const estimating = enrichment.isBusy("nutrition-estimation");

  if (!showNutrition || (!shown && !estimating)) return null;

  const shares = shown ? macroCalorieShares(shown) : [];
  const leftOut = !stored ? (workedOut?.leftOut ?? []) : [];
  const step = (next: number) => setPortions(Math.max(1, portions + next));

  return (
    <SectionCard
      right={
        shown && !estimating ? (
          <View className="flex-row items-center gap-1">
            <Pressable
              accessibilityLabel={intl.formatMessage({ id: "recipes.nutrition.decreasePortions" })}
              accessibilityRole="button"
              className="bg-default size-9 items-center justify-center rounded-full"
              style={tint ? { backgroundColor: tint.soft } : undefined}
              onPress={() => step(-1)}
            >
              <Ionicons color={foreground} name="remove" size={17} />
            </Pressable>
            <Text className="text-foreground min-w-14 text-center text-sm font-semibold">
              {intl.formatMessage({ id: "recipes.nutrition.portions" }, { count: portions })}
            </Text>
            <Pressable
              accessibilityLabel={intl.formatMessage({ id: "recipes.nutrition.increasePortions" })}
              accessibilityRole="button"
              className="bg-default size-9 items-center justify-center rounded-full"
              style={tint ? { backgroundColor: tint.soft } : undefined}
              onPress={() => step(1)}
            >
              <Ionicons color={foreground} name="add" size={17} />
            </Pressable>
          </View>
        ) : null
      }
      testID="recipe-nutrition"
      title={intl.formatMessage({ id: "recipes.nutrition.title" })}
    >
      {estimating || !shown ? (
        <Text className="text-muted py-6 text-center text-sm">
          {intl.formatMessage({ id: "recipes.actions.estimatingNutrition" })}
        </Text>
      ) : (
        <>
          <View className="flex-row items-center gap-5 pt-1">
            {shares.length > 0 ? <NutritionDonut figures={shown} portions={portions} /> : null}
            <View className="min-w-0 flex-1">
              {shares.length === 0 && shown.calories != null ? (
                <Text className="text-foreground text-base font-semibold">
                  {`${Math.round(shown.calories * portions)} kcal`}
                </Text>
              ) : null}
              {shares.map((macro) => (
                <View
                  key={macro.key}
                  className="border-separator flex-row items-center justify-between gap-2 border-b py-2"
                >
                  <View className="flex-row items-center gap-2">
                    <Ionicons
                      color={macroColor[macro.key]}
                      name={MACRO_ICON[macro.key]}
                      size={16}
                    />
                    <Text className="text-foreground text-base">
                      {intl.formatMessage({ id: `recipes.nutrition.${macro.key}` })}
                    </Text>
                  </View>
                  <Text className="text-foreground text-base font-semibold">
                    {`${Math.round((shown[macro.key] ?? macro.grams) * portions)} `}
                    <Text className="text-muted font-normal">g</Text>
                  </Text>
                </View>
              ))}
            </View>
          </View>
          {!stored && workedOut?.estimated ? (
            <Text className="text-muted pt-2 text-xs">
              {intl.formatMessage({ id: "recipes.nutrition.estimated" })}
            </Text>
          ) : null}
          {leftOut.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: listOpen }}
              className="flex-row items-center gap-1 pt-3"
              onPress={() => setListOpen(!listOpen)}
            >
              <Ionicons
                color={muted}
                name={listOpen ? "chevron-down" : "chevron-forward"}
                size={14}
              />
              <Text className="text-muted text-sm">
                {intl.formatMessage({ id: "recipes.nutrition.leftOut" }, { count: leftOut.length })}
              </Text>
            </Pressable>
          ) : null}
          {listOpen
            ? leftOut.map(({ lineId, name, reason, estimatedByAI }) => (
                <View key={lineId} className="flex-row flex-wrap items-baseline gap-x-2 pt-1">
                  <Text className="text-foreground text-sm">{plainText(name)}</Text>
                  <Text className="text-muted text-xs">
                    {estimatedByAI
                      ? intl.formatMessage({ id: "recipes.nutrition.estimatedByAI" })
                      : intl.formatMessage({
                          id: `recipes.nutrition.reasons.${REASON_KEYS[reason]}`,
                        })}
                  </Text>
                </View>
              ))
            : null}
        </>
      )}
    </SectionCard>
  );
}
