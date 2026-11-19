import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { AnimatedNumber } from "@/components/animated-number";
import { Stepper } from "@/components/stepper";
import { useTokenColor } from "@/hooks/use-token-color";
import { EASE_OUT } from "@/lib/motion/ease";
import { timedTo } from "@/lib/motion/timed";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { useHiddenItemVisibility } from "@norish/shared-react/reader";
import {
  useLoadedPageRecipe,
  usePageEnrichment,
  useWorkedOutNutrition,
} from "@norish/shared-react/recipes";
import { workedOutSources } from "@norish/shared/lib/recipe-nutrition";

import type { NutritionFigures } from "../utils/stored-nutrition";
import { DAILY_REFERENCE, percentOfReference } from "../utils/nutrition-reference";
import { aroundCount } from "../utils/portions-label";
import { plainText } from "../utils/recipe-rows";
import { storedNutrition } from "../utils/stored-nutrition";
import { SectionCard } from "./tint";

const REASON_KEYS = {
  seasoning: "seasoning",
  "no-amount": "noAmount",
  "no-size": "noSize",
  "no-numbers": "noNumbers",
  "no-spoon-weight": "noSpoonWeight",
  "no-piece-weight": "noPieceWeight",
} as const;

/** "2 portions" with the 2 rolling and the word still. */
function PortionsLabel({ portions }: { portions: number }) {
  const intl = useIntl();
  const label = intl.formatMessage({ id: "recipes.nutrition.portions" }, { count: portions });
  const around = aroundCount(label, intl.formatNumber(portions));
  const className = "text-foreground text-sm font-semibold";

  return (
    <View className="min-w-14 flex-row items-center justify-center">
      {around ? (
        <>
          {around[0] ? <Text className={className}>{around[0]}</Text> : null}
          <AnimatedNumber className={className} value={intl.formatNumber(portions)} />
          {around[1] ? <Text className={className}>{around[1]}</Text> : null}
        </>
      ) : (
        <Text className={className}>{label}</Text>
      )}
    </View>
  );
}

const MACROS = ["protein", "carbs", "fat"] as const;

/** How long a bar takes to its new width when the portion changes. */
const BAR_MS = 250;

/** A figure's share of its reference, as a thin bar of `color` on a track; it grows or shrinks to a new share. */
function ReferenceBar({
  percent,
  color,
  label,
  height,
}: {
  percent: number;
  color?: string;
  label: string;
  height: number;
}) {
  const width = Math.min(percent, 100);
  const share = useSharedValue(width);
  const widthStyle = useAnimatedStyle(() => ({ width: `${share.get()}%` }));

  useEffect(() => {
    share.set(timedTo(width, BAR_MS, { easing: EASE_OUT }));
  }, [width, share]);

  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="image"
      className="bg-default overflow-hidden"
      style={{ height, borderRadius: height / 2 }}
    >
      <Animated.View
        className={color ? "" : "bg-foreground"}
        style={[
          { height, borderRadius: height / 2 },
          color ? { backgroundColor: color } : null,
          widthStyle,
        ]}
      />
    </View>
  );
}

/** The calories as one big number, against the daily reference. */
function CalorieBar({ calories }: { calories: number }) {
  const intl = useIntl();
  const percent = percentOfReference(calories, DAILY_REFERENCE.calories);
  const caption = intl.formatMessage(
    { id: "recipes.nutrition.percentOfDailyReference" },
    { percent, amount: `${intl.formatNumber(DAILY_REFERENCE.calories)} kcal` }
  );

  return (
    <View className="gap-[14px] pt-1.5">
      <View className="flex-row items-baseline gap-1.5">
        <AnimatedNumber
          className="text-foreground text-[60px] leading-[60px] font-semibold tracking-[-2.7px]"
          value={String(Math.round(calories))}
        />
        <Text className="text-muted text-lg font-medium">kcal</Text>
      </View>
      <View className="gap-[7px]">
        <ReferenceBar height={6} label={caption} percent={percent} />
        <Text className="text-muted text-[13px]">{caption}</Text>
      </View>
    </View>
  );
}

/** One macro as an open column: its label, the grams, and the share of its reference. */
function MacroColumn({
  macro,
  grams,
  color,
}: {
  macro: (typeof MACROS)[number];
  grams: number;
  color?: string;
}) {
  const intl = useIntl();
  const percent = percentOfReference(grams, DAILY_REFERENCE[macro]);
  const share = intl.formatMessage(
    { id: "recipes.nutrition.percentOfReference" },
    { percent, amount: `${DAILY_REFERENCE[macro]} g` }
  );

  return (
    <View className="min-w-0 flex-1 gap-1" testID={`nutrition-${macro}`}>
      <View className="flex-row items-center gap-1.5">
        <View className="size-[7px] rounded-full" style={{ backgroundColor: color }} />
        <Text className="text-muted text-[13px]">
          {intl.formatMessage({ id: `recipes.nutrition.${macro}` })}
        </Text>
      </View>
      <View className="flex-row items-baseline gap-[3px]">
        <AnimatedNumber
          className="text-foreground text-[28px] leading-8 font-semibold tracking-[-0.8px]"
          value={String(Math.round(grams))}
        />
        <Text className="text-muted text-[15px]">g</Text>
      </View>
      <Text className="text-muted text-xs">{share}</Text>
      <View className="pt-1">
        <ReferenceBar color={color} height={4} label={share} percent={percent} />
      </View>
    </View>
  );
}

/** Nutrition: stored values, else the total worked out from the lines; portions scale it. */
export function NutritionSection() {
  const intl = useIntl();
  const recipe = useLoadedPageRecipe();
  const enrichment = usePageEnrichment();
  const { showNutrition } = useHiddenItemVisibility();
  const workedOut = useWorkedOutNutrition(recipe);
  const [portions, setPortions] = useState(1);
  const [listOpen, setListOpen] = useState(false);
  const [muted] = useThemeColor(["muted"] as const);
  const macroColor = {
    fat: useTokenColor("nutrition-fat"),
    carbs: useTokenColor("nutrition-carbs"),
    protein: useTokenColor("nutrition-protein"),
  };
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

  const leftOut = !stored ? (workedOut?.leftOut ?? []) : [];
  const step = (next: number) => setPortions(Math.max(1, portions + next));

  return (
    <SectionCard
      right={
        shown && !estimating ? (
          <Stepper
            canDecrement={portions > 1}
            decreaseLabel={intl.formatMessage({ id: "recipes.nutrition.decreasePortions" })}
            increaseLabel={intl.formatMessage({ id: "recipes.nutrition.increasePortions" })}
            testID="recipe-portions"
            onDecrement={() => step(-1)}
            onIncrement={() => step(1)}
          >
            <PortionsLabel portions={portions} />
          </Stepper>
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
          {shown.calories != null ? <CalorieBar calories={shown.calories * portions} /> : null}
          <View className="mt-5 flex-row gap-[18px]">
            {MACROS.map((key) => {
              const grams = shown[key];

              return grams == null ? null : (
                <MacroColumn
                  key={key}
                  color={macroColor[key]}
                  grams={grams * portions}
                  macro={key}
                />
              );
            })}
          </View>
          {!stored && workedOut?.estimated ? (
            <Text className="text-muted pt-2 text-xs">
              {intl.formatMessage({ id: "recipes.nutrition.estimated" })}
            </Text>
          ) : null}
          {!stored && workedOut ? (
            <Text className="text-muted pt-2 text-xs" testID="nutrition-credit">
              {intl.formatMessage(
                { id: "recipes.nutrition.workedOutFrom" },
                {
                  sources: intl.formatList(
                    workedOutSources(
                      workedOut,
                      intl.formatMessage({ id: "recipes.nutrition.householdNumbers" })
                    ),
                    { type: "conjunction" }
                  ),
                }
              )}
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
