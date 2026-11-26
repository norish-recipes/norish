import React, { useState } from "react";
import { View } from "react-native";
import { ChipRow } from "@/components/chip-row";
import { ChoiceCard } from "@/components/choice-card";
import { Section } from "@/components/section";
import { FitSheet } from "@/components/sheet";
import { SheetInput } from "@/components/sheet-input";
import { SheetNote } from "@/components/sheet-note";
import { Stack } from "@/components/stack";
import { ToggleChip } from "@/components/toggle-chip";
import { useText } from "@/lib/i18n/use-text";
import { useIntl } from "react-intl";

import type { FactDraft, NutritionFactName, PickedFood } from "@norish/shared-react/ingredients";
import type {
  IngredientNutrition,
  NutritionFact,
} from "@norish/shared/contracts/ingredient-nutrition";
import type { SpoonMeasure } from "@norish/shared/lib/spoon-measure";
import {
  LABEL_FIELDS,
  spoonKey,
  useDatasetFoodSearch,
  useNutritionDraft,
} from "@norish/shared-react/ingredients";
import { useConnectivity } from "@norish/shared-react/offline/react";
import { spoonWeight } from "@norish/shared/lib/spoon-measure";

import { factSourceText } from "../utils/nutrition-text";

const MODES = ["sources", "food", "label"] as const;
const MODE_COPY = { sources: "useSources", food: "pickFood", label: "typeLabel" } as const;

/** Correct a food's nutrition for the household, fact by fact: as Norish has it, a dataset food, or a label's numbers. */
export function NutritionCorrectionStep({
  ingredientId,
  name,
  current,
  measure,
  askSpoon,
  onClose,
}: {
  ingredientId: string;
  name: string;
  current: IngredientNutrition | null;
  measure: SpoonMeasure | null;
  askSpoon: boolean;
  onClose: () => void;
}) {
  const text = useText();
  const intl = useIntl();
  const t = (key: string, values?: Record<string, string | number>) =>
    text(`settings.ingredients.nutrition.${key}`, values);
  const { isOffline } = useConnectivity();
  const nutrition = useNutritionDraft({ ingredientId, current, measure, askSpoon, onClose });
  const { spoon, draft, facts, corrected, canSave, set } = nutrition;
  const whole = (value: number) => intl.formatNumber(value, { maximumFractionDigits: 1 });
  const nowLine = <T,>(fact: NutritionFact<T> | null | undefined, value: (v: T) => string) =>
    fact
      ? t("current", { value: value(fact.value), source: factSourceText(text, fact) })
      : t("currentNone");
  const now: Record<NutritionFactName, string> = {
    numbers: nowLine(current?.numbers, (v) => t("kcal", { value: whole(v.kcal) })),
    pieceWeight: nowLine(current?.pieceWeight, (g) => t("grams", { value: whole(g) })),
    density: nowLine(current?.density, (d) => t("grams", { value: whole(spoonWeight(d, spoon)) })),
  };

  return (
    <FitSheet
      back
      confirm={{
        label: text("common.actions.save"),
        disabled: !canSave || isOffline,
        onPress: nutrition.save,
      }}
      name="nutrition-correction"
      secondary={
        corrected
          ? [
              {
                label: t("remove"),
                symbol: "trash",
                destructive: true,
                disabled: isOffline,
                onPress: nutrition.removeAll,
              },
            ]
          : undefined
      }
      title={t("correctTitle", { name })}
      onClose={onClose}
    >
      <SheetNote>{t("correctIntro")}</SheetNote>
      {isOffline ? <SheetNote>{text("settings.content.offline")}</SheetNote> : null}
      {facts.map((fact) => (
        <FactEditor
          key={fact}
          draft={draft[fact]}
          fact={fact}
          now={now[fact]}
          overHundred={nutrition.overHundred.includes(fact)}
          spoon={spoon}
          onChange={(next) => set(fact, next)}
        />
      ))}
    </FitSheet>
  );
}

function FactEditor({
  fact,
  draft,
  now,
  overHundred,
  spoon,
  onChange,
}: {
  fact: NutritionFactName;
  draft: FactDraft;
  now: string;
  overHundred: boolean;
  spoon: SpoonMeasure;
  onChange: (next: Partial<FactDraft>) => void;
}) {
  const text = useText();
  const t = (key: string) => text(`settings.ingredients.nutrition.${key}`);
  const fields = LABEL_FIELDS[fact];

  return (
    <View testID={`nutrition-correction-${fact}`}>
      <Section title={fact === "density" ? t(`spoon.${spoonKey(spoon)}`) : t(`facts.${fact}`)}>
        <Stack>
          <SheetNote>{now}</SheetNote>
          <ChipRow>
            {MODES.map((mode) => (
              <ToggleChip
                key={mode}
                active={draft.mode === mode}
                label={t(MODE_COPY[mode])}
                testID={`nutrition-correction-${fact}-${mode}`}
                onPress={() => onChange({ mode })}
              />
            ))}
          </ChipRow>
          {draft.mode === "food" ? (
            <DatasetFoodPicker
              fact={fact}
              picked={draft.food}
              spoon={spoon}
              onPick={(food) => onChange({ food })}
            />
          ) : null}
          {draft.mode === "label"
            ? fields.map((field, index) => {
                const label =
                  fact === "density"
                    ? t(`label.spoonGrams.${spoonKey(spoon)}`)
                    : t(`label.${field}`);

                // Titled, as the sheets' other fields are, so the label stays once it holds a value.
                return (
                  <Section key={field} dense title={label}>
                    <SheetInput
                      accessibilityLabel={label}
                      keyboardType="decimal-pad"
                      testID={`nutrition-correction-${field}`}
                      value={draft.typed[index] ?? ""}
                      onChangeText={(value) => {
                        const typed = [...draft.typed];

                        typed[index] = value;
                        onChange({ typed });
                      }}
                    />
                  </Section>
                );
              })
            : null}
          {overHundred ? <SheetNote tone="problem">{t("overHundred")}</SheetNote> : null}
        </Stack>
      </Section>
    </View>
  );
}

/** Finds a dataset food by the words of its name; a piece weight or density only offers foods with one. */
function DatasetFoodPicker({
  fact,
  picked,
  spoon,
  onPick,
}: {
  fact: NutritionFactName;
  picked: PickedFood | null;
  spoon: SpoonMeasure;
  onPick: (food: PickedFood | null) => void;
}) {
  const text = useText();
  const intl = useIntl();
  const t = (key: string, values?: Record<string, string | number>) =>
    text(`settings.ingredients.nutrition.${key}`, values);
  const [term, setTerm] = useState(picked?.name ?? "");
  const { options, hint } = useDatasetFoodSearch(fact, term);
  const detail = (food: (typeof options)[number]) =>
    [
      food.dataset,
      fact === "numbers"
        ? t("kcal", { value: intl.formatNumber(food.kcal, { maximumFractionDigits: 0 }) })
        : fact === "pieceWeight"
          ? t("grams", {
              value: intl.formatNumber(food.pieceWeight ?? 0, { maximumFractionDigits: 0 }),
            })
          : t(`spoonGrams.${spoonKey(spoon)}`, {
              value: intl.formatNumber(spoonWeight(food.density ?? 0, spoon), {
                maximumFractionDigits: 1,
              }),
            }),
    ].join(" · ");

  return (
    <Stack>
      <SheetInput
        accessibilityLabel={t("searchFood")}
        autoCapitalize="none"
        placeholder={t("searchFood")}
        testID="nutrition-food-picker"
        value={term}
        onChangeText={(value) => {
          setTerm(value);
          if (picked) onPick(null);
        }}
      />
      {picked ? <SheetNote>{picked.name}</SheetNote> : null}
      {!picked && hint ? (
        <SheetNote>
          {t(hint === "hint" ? "foodHint" : hint === "searching" ? "searchingFoods" : "noFoods")}
        </SheetNote>
      ) : null}
      {!picked && options.length > 0 ? (
        <ChoiceCard
          options={options.map((food) => ({
            id: food.id,
            label: food.name,
            hint: detail(food),
            testID: "nutrition-food-option",
          }))}
          onPick={(id) => {
            const food = options.find((each) => each.id === id);

            if (!food) return;
            setTerm(food.name);
            onPick({
              key: food.id,
              name: food.name,
              kcal: food.kcal,
              pieceWeight: food.pieceWeight,
              density: food.density,
            });
          }}
        />
      ) : null}
    </Stack>
  );
}
