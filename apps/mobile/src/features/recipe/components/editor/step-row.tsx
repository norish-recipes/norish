import type { ComponentRef } from "react";
import type { TextInput } from "react-native";
import React, { useState } from "react";
import { ActionSheetIOS, Pressable, Text, View } from "react-native";
import { useCancelButton } from "@/hooks/use-cancel-button";
import { useIntl } from "react-intl";

import type {
  IngredientSuggestion,
  ParsedIngredient,
  StepIngredientDraft,
  StepRow as StepRowValue,
} from "@norish/shared-react/recipes";
import {
  hasStepContent,
  ingredientTriggerAt,
  isHeadingText,
  matchIngredientSuggestions,
  replaceTrigger,
  stepChipLabel,
} from "@norish/shared-react/recipes";

import { IngredientIcon } from "../ingredient-icon";
import { DragGrip, EditorInput, RowIconButton } from "./editor-parts";
import { MentionPopup } from "./mention-popup";
import { StepPhotos } from "./step-photos";

/** A step's share presets, as web's chip menu lists them. */
const SHARES = [
  ["full", 1],
  ["half", 0.5],
  ["third", 1 / 3],
  ["quarter", 0.25],
] as const;

/** One numbered step: its field with the `@` popup, its chips, its photos and its buttons. */
export function StepRow({
  row,
  index,
  number,
  isOnlyRow,
  focused,
  chipLines,
  suggestions,
  foods,
  inputProps,
  drag,
  onType,
  onLeave,
  onMention,
  onRefsChange,
  onAddPhoto,
  onRemovePhoto,
  onRemove,
}: {
  row: StepRowValue;
  index: number;
  number: number | null;
  isOnlyRow: boolean;
  focused: boolean;
  chipLines: ParsedIngredient[];
  suggestions: IngredientSuggestion[];
  foods: ReadonlyMap<string, string | null>;
  inputProps: {
    ref: (input: ComponentRef<typeof TextInput> | null) => void;
    autoFocus: boolean;
    onFocus: () => void;
    onSubmitEditing: () => void;
  };
  drag: () => void;
  onType: (text: string) => void;
  onLeave: () => void;
  /** An `@` pick: the text with the line's name in place of the query. */
  onMention: (suggestion: IngredientSuggestion, text: string) => void;
  onRefsChange: (refs: StepIngredientDraft[]) => void;
  onAddPhoto: () => void;
  onRemovePhoto: (imageIndex: number) => void;
  onRemove: () => void;
}) {
  const intl = useIntl();
  const cancel = useCancelButton();
  // The caret, so the `@` popup reads the text before it.
  const [caret, setCaret] = useState(0);
  const text = (id: string, values?: Record<string, string>) => intl.formatMessage({ id }, values);
  const heading = isHeadingText(row.text);
  const match =
    focused && suggestions.length > 0
      ? ingredientTriggerAt(row.text, Math.min(caret, row.text.length))
      : null;
  const matches = match ? matchIngredientSuggestions(suggestions, match.query) : [];

  const pickMention = (suggestion: IngredientSuggestion) => {
    if (!match) return;
    const inserted = replaceTrigger(row.text, match, suggestion.label);

    onMention(suggestion, inserted.text);
    setCaret(inserted.caret);
  };
  const editChip = (line: ParsedIngredient) =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: line.ingredientName,
        options: [
          ...SHARES.map(([key]) => text(`recipes.stepIngredients.share.${key}`)),
          text("recipes.stepIngredients.removeLabel", { name: line.ingredientName }),
          cancel.text,
        ],
        destructiveButtonIndex: SHARES.length,
        cancelButtonIndex: SHARES.length + 1,
      },
      (choice) => {
        const share = SHARES[choice]?.[1];

        if (choice === SHARES.length) {
          onRefsChange(row.stepIngredients.filter((ref) => ref.ingredientOrder !== line.order));
        } else if (share !== undefined) {
          onRefsChange(
            row.stepIngredients.map((ref) =>
              ref.ingredientOrder === line.order ? { ...ref, share } : ref
            )
          );
        }
      }
    );

  return (
    <View
      className={`flex-row gap-3 py-3 ${index === 0 ? "" : "border-separator border-t"}`}
      testID={`editor-step-${index}`}
    >
      <View className="bg-default size-7 items-center justify-center rounded-full">
        {heading || number === null ? null : (
          <Text className="text-foreground text-[13px] font-semibold">{number}</Text>
        )}
      </View>
      <View className="flex-1 gap-2">
        <EditorInput
          {...inputProps}
          multiline
          accessibilityLabel={text(
            heading ? "recipes.editor.sectionHeading" : "recipes.editor.step"
          )}
          className={`text-foreground py-0 text-[17px] leading-6 ${heading ? "font-semibold" : ""}`}
          placeholder={isOnlyRow ? text("recipes.stepInput.stepPlaceholder", { number: "1" }) : ""}
          returnKeyType="next"
          submitBehavior="submit"
          testID={`editor-step-input-${index}`}
          value={row.text}
          onBlur={onLeave}
          onChangeText={onType}
          onSelectionChange={({ nativeEvent }) => setCaret(nativeEvent.selection.start)}
        />
        {matches.length > 0 ? (
          <MentionPopup foods={foods} matches={matches} onPick={pickMention} />
        ) : null}
        {!heading && row.stepIngredients.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5">
            {row.stepIngredients.map((ref) => {
              const line = chipLines.find((candidate) => candidate.order === ref.ingredientOrder);

              return line ? (
                <Pressable
                  key={ref.ingredientOrder}
                  accessibilityLabel={text("recipes.stepIngredients.shareLabel", {
                    name: line.ingredientName,
                  })}
                  accessibilityRole="button"
                  className="bg-default h-7 flex-row items-center gap-1 rounded-full px-2.5"
                  onPress={() => editChip(line)}
                >
                  <IngredientIcon ingredientId={foods.get(line.ingredientName) ?? null} size={18} />
                  <Text className="text-foreground text-[13px] font-medium">
                    {stepChipLabel(line, ref.share)}
                  </Text>
                </Pressable>
              ) : null;
            })}
          </View>
        ) : null}
        {row.images.length > 0 ? (
          <StepPhotos images={row.images} rowIndex={index} onRemove={onRemovePhoto} />
        ) : null}
      </View>
      <View className="items-center">
        {heading ? null : (
          <RowIconButton
            icon="image-outline"
            label={text("recipes.editor.addStepPhoto")}
            testID={`editor-step-photo-${index}`}
            onPress={onAddPhoto}
          />
        )}
        {focused && hasStepContent(row) ? (
          <RowIconButton
            icon="close-circle"
            label={text("recipes.editor.removeStep")}
            testID={`editor-step-remove-${index}`}
            onPress={onRemove}
          />
        ) : hasStepContent(row) ? (
          <DragGrip label={text("recipes.gallery.dragToReorder")} onDrag={drag} />
        ) : null}
      </View>
    </View>
  );
}
