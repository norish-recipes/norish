import React from "react";
import { Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useIntl } from "react-intl";

import { macroCalorieShares } from "@norish/shared/lib/nutrition-macros";

import type { NutritionFigures } from "../utils/stored-nutrition";
import { useTokenColor } from "../hooks/use-token-color";

export function NutritionDonut({
  figures,
  portions,
}: {
  figures: NutritionFigures;
  portions: number;
}) {
  const intl = useIntl();
  const colors = {
    fat: useTokenColor("nutrition-fat"),
    carbs: useTokenColor("nutrition-carbs"),
    protein: useTokenColor("nutrition-protein"),
  };
  const shares = macroCalorieShares(figures).map((macro, index, all) => ({
    ...macro,
    offset: -all.slice(0, index).reduce((sum, before) => sum + before.share * 100, 0),
  }));

  return (
    <View className="size-32 items-center justify-center">
      <Svg
        height={128}
        style={{ transform: [{ rotate: "-90deg" }] }}
        viewBox="0 0 36 36"
        width={128}
      >
        {shares.map((macro) => (
          <Circle
            key={macro.key}
            cx="18"
            cy="18"
            fill="none"
            r="15.9155"
            stroke={colors[macro.key]}
            strokeDasharray={`${macro.share * 100} ${100 - macro.share * 100}`}
            strokeDashoffset={macro.offset}
            strokeWidth="3.6"
          />
        ))}
      </Svg>
      {figures.calories != null ? (
        <View className="absolute items-center">
          <Text className="text-foreground text-2xl font-semibold">
            {String(Math.round(figures.calories * portions))}
          </Text>
          <Text className="text-muted text-xs">
            {intl.formatMessage({ id: "recipes.nutrition.calories" })}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
