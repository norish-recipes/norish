import React, { useState } from "react";
import { Alert, Text, View } from "react-native";
import { AiChange } from "@/components/ai-change";
import { Card, CardRow } from "@/components/card";
import { destructiveAction } from "@/components/modal-header";
import { PillButton } from "@/components/pill-button";
import { Sheet, SheetBody } from "@/components/sheet";
import { SheetFieldSkeleton, SheetInput } from "@/components/sheet-input";
import { SheetNote } from "@/components/sheet-note";
import { Switch } from "@/components/switch";
import { useCancelButton } from "@/hooks/use-cancel-button";
import { useText } from "@/lib/i18n/use-text";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIntl } from "react-intl";

import type { IngredientItem } from "@norish/shared-react/ingredients";
import {
  changeCopy,
  DELETE_TOUCHES,
  isOpenChange,
  useAIChangeMutations,
  useAIChangesQuery,
  useIngredientDraft,
  useIngredientNutritionQuery,
  useIngredientQuery,
  useIngredientUsesQuery,
} from "@norish/shared-react/ingredients";
import { ingredientDisplayName } from "@norish/shared/lib/ingredient-names";

import { FoodIconField } from "../components/food-icon-field";
import { FoodNutritionStep } from "../components/food-nutrition-step";
import { FoodPickerStep } from "../components/food-picker-step";
import { FoodSpellingsStep } from "../components/food-spellings-step";
import { NutritionCorrectionStep } from "../components/nutrition-correction-step";

type Step = "food" | "spellings" | "nutrition" | { correct: boolean };

/** One food of the catalogue, a sheet that fits its content: its name, icon, spellings, parent and
 * nutrition, merge and delete; spellings, nutrition and the pickers are pages inside it. */
export function IngredientScreen() {
  const text = useText();
  const { locale } = useIntl();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useIngredientQuery(id, locale);

  if (!item || item.id !== id) {
    return (
      <Sheet name="food" title={text("settings.ingredients.title")}>
        <SheetBody>
          <SheetFieldSkeleton />
        </SheetBody>
      </Sheet>
    );
  }

  return <FoodSheet key={item.id} item={item} />;
}

function FoodSheet({ item }: { item: IngredientItem }) {
  const text = useText();
  const router = useRouter();
  const cancel = useCancelButton();
  const { locale } = useIntl();
  const displayName = ingredientDisplayName(item, locale);
  const draft = useIngredientDraft(item, displayName, () => router.back());
  const [step, setStep] = useState<Step>("food");
  const { uses } = useIngredientUsesQuery(item.id);
  const { nutrition, measure } = useIngredientNutritionQuery(item.id);
  const aiChanges = useAIChangeMutations();
  const unsure = useAIChangesQuery((changes) =>
    changes.filter((change) => change.ingredient?.id === item.id && isOpenChange(change))
  );
  const t = (key: string, values?: Record<string, string | number>) =>
    text(`settings.ingredients.${key}`, values);
  const back = () => setStep("food");

  if (draft.relocation) {
    return (
      <FoodPickerStep
        ingredient={{ id: item.id, name: displayName }}
        relocation={draft.relocation}
        onBack={() => draft.setRelocation(null)}
        onConfirm={draft.saveRelocation}
      />
    );
  }
  if (step === "spellings") return <FoodSpellingsStep draft={draft} item={item} onBack={back} />;
  if (step === "nutrition") {
    return (
      <FoodNutritionStep
        ingredientId={item.id}
        onBack={back}
        onCorrect={(askSpoon) => setStep({ correct: askSpoon })}
      />
    );
  }
  if (typeof step === "object") {
    return (
      <NutritionCorrectionStep
        askSpoon={step.correct}
        current={nutrition}
        ingredientId={item.id}
        measure={measure}
        name={displayName}
        onClose={() => setStep("nutrition")}
      />
    );
  }

  const confirmDelete = () => {
    const touched = DELETE_TOUCHES.filter((key) => (uses?.counts[key] ?? 0) > 0);

    Alert.alert(
      t("deleteTitle", { name: displayName }),
      [
        t("deleteConfirm"),
        ...touched.map((key) => t(`deleteTouches.${key}`, { count: uses?.counts[key] ?? 0 })),
      ].join("\n"),
      [
        cancel,
        {
          text: text("common.actions.delete"),
          style: "destructive",
          onPress: draft.remove,
        },
      ]
    );
  };
  const parentName = draft.parent ? ingredientDisplayName(draft.parent, locale) : undefined;

  return (
    <Sheet
      confirm={{
        label: text("common.actions.save"),
        disabled: !draft.dirty,
        onPress: async () => {
          if (await draft.save()) router.back();
        },
      }}
      name="food"
      secondary={
        item.canEdit
          ? [
              {
                ...destructiveAction(text("common.actions.delete"), confirmDelete),
                disabled: !uses,
              },
            ]
          : undefined
      }
      title={displayName}
    >
      <SheetBody>
        <View className="flex-row items-start gap-3">
          <FoodIconField icons={draft.icons} item={item} onDraftChange={draft.setIcon} />
          <View className="min-w-0 flex-1">
            {item.canEdit ? (
              <SheetInput
                accessibilityLabel={t("rename")}
                returnKeyType="done"
                testID="food-name"
                value={draft.name}
                onChangeText={draft.setName}
                onSubmitEditing={() => void draft.save()}
              />
            ) : (
              <Text className="text-foreground text-lg font-medium">{item.name}</Text>
            )}
          </View>
        </View>
        {displayName !== item.name ? (
          <SheetNote>{t("shownAs", { name: displayName })}</SheetNote>
        ) : null}
        {unsure.map((change) => {
          const copy = changeCopy(change, locale);

          return (
            <Card key={change.id}>
              <AiChange
                id={change.id}
                note={t(copy.key, copy.values)}
                testID="food-ai-change"
                onKeep={change.canAct ? () => void aiChanges.keep(change) : undefined}
                onUndo={change.canAct ? () => void aiChanges.undo(change) : undefined}
              />
            </Card>
          );
        })}
        {item.flagged ? (
          <SheetNote tone="problem" testID="food-flag">
            {t(`flagReasons.${item.flagReason ?? "unknown"}`)}
          </SheetNote>
        ) : null}
        <Card>
          <CardRow
            first
            label={t("spellingsSection")}
            testID="food-spellings"
            value={String(draft.spellingCount)}
            onPress={() => setStep("spellings")}
          />
          <CardRow
            label={t("parentSection")}
            testID="food-parent"
            value={parentName ?? "-"}
            onPress={item.canEdit ? () => draft.setRelocation({ kind: "parent" }) : undefined}
          />
          {draft.parent && item.canEdit ? (
            <CardRow
              label={t("clearParent")}
              testID="food-clear-parent"
              onPress={() => draft.setParent(null)}
            />
          ) : null}
          <CardRow
            label={text("settings.ingredients.nutrition.section")}
            testID="food-nutrition"
            value={
              nutrition?.numbers
                ? text("settings.ingredients.nutrition.summary", {
                    value: Math.round(nutrition.numbers.value.kcal),
                  })
                : text("settings.ingredients.nutrition.summaryNone")
            }
            onPress={() => setStep("nutrition")}
          />
          {item.flagged && item.canEdit ? (
            <CardRow label={t("markDistinct")}>
              <Switch
                accessibilityLabel={t("markDistinct")}
                isSelected={false}
                testID="food-keep-distinct"
                onSelectedChange={() => void draft.markDistinct()}
              />
            </CardRow>
          ) : null}
        </Card>
        {item.canEdit ? (
          <PillButton
            centred
            icon="git-merge-outline"
            label={t("mergeInto")}
            testID="food-merge"
            onPress={() => draft.setRelocation({ kind: "merge" })}
          />
        ) : null}
      </SheetBody>
    </Sheet>
  );
}
