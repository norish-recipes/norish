import React from "react";
import { View } from "react-native";
import { Card, CardRow } from "@/components/card";
import { EmptyCard } from "@/components/empty-card";
import { Sheet, SheetBody } from "@/components/sheet";
import { SheetNote } from "@/components/sheet-note";
import { useText } from "@/lib/i18n/use-text";
import { useIntl } from "react-intl";

import type { IngredientNutrition } from "@norish/shared/contracts/ingredient-nutrition";
import { spoonKey, useIngredientNutritionQuery } from "@norish/shared-react/ingredients";
import { spoonWeight } from "@norish/shared/lib/spoon-measure";

import { factSourceText } from "../utils/nutrition-text";

/** What Norish knows of a food's nutrition, with where each number came from; Correct opens the correction. */
export function FoodNutritionStep({
  ingredientId,
  onCorrect,
  onBack,
}: {
  ingredientId: string;
  onCorrect: (askSpoon: boolean) => void;
  onBack: () => void;
}) {
  const text = useText();
  const intl = useIntl();
  const { nutrition: facts, measure } = useIngredientNutritionQuery(ingredientId);
  const number = (value: number) => intl.formatNumber(value, { maximumFractionDigits: 1 });
  const t = (key: string, values?: Record<string, string | number>) =>
    text(`settings.ingredients.nutrition.${key}`, values);
  const fact = (
    label: string,
    value: string,
    source: IngredientNutrition["numbers"],
    first: boolean
  ) => (
    <CardRow
      first={first}
      hint={source ? factSourceText(text, source) : undefined}
      label={label}
      value={value}
    />
  );
  const none = !facts?.numbers && !facts?.pieceWeight && !measure;

  return (
    <Sheet
      back
      confirm={{ label: t("correct"), onPress: () => onCorrect(false) }}
      name="food-nutrition"
      title={t("section")}
      onClose={onBack}
    >
      <SheetBody>
        {none ? (
          <EmptyCard
            icon="nutrition-outline"
            placement="sheet"
            testID="food-nutrition-none"
            title={t("none")}
          />
        ) : (
          <Card testID="food-nutrition-facts">
            {facts?.numbers ? (
              <>
                {fact(
                  t("calories"),
                  t("kcal", { value: number(facts.numbers.value.kcal) }),
                  facts.numbers,
                  true
                )}
                {fact(
                  t("fat"),
                  t("grams", { value: number(facts.numbers.value.fat) }),
                  null,
                  false
                )}
                {fact(
                  t("carbs"),
                  t("grams", { value: number(facts.numbers.value.carbs) }),
                  null,
                  false
                )}
                {fact(
                  t("protein"),
                  t("grams", { value: number(facts.numbers.value.protein) }),
                  null,
                  false
                )}
              </>
            ) : (
              <CardRow first label={t("noNumbers")} />
            )}
            {facts?.pieceWeight ? (
              <CardRow
                hint={factSourceText(text, facts.pieceWeight)}
                label={t("onePieceLabel")}
                value={t("grams", { value: number(facts.pieceWeight.value) })}
              />
            ) : null}
            {measure ? (
              <CardRow
                hint={facts?.density ? factSourceText(text, facts.density) : t("currentNone")}
                label={t(`spoon.${spoonKey(measure)}`)}
                testID="food-nutrition-spoon"
                value={
                  facts?.density
                    ? t("grams", { value: number(spoonWeight(facts.density.value, measure)) })
                    : t("spoonAsk")
                }
                onPress={facts?.density ? undefined : () => onCorrect(true)}
              />
            ) : null}
          </Card>
        )}
        <View>
          <SheetNote>{t("per100g")}</SheetNote>
        </View>
      </SheetBody>
    </Sheet>
  );
}
