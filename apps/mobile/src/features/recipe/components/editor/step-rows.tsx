import type * as ImagePicker from "expo-image-picker";
import type { ComponentRef } from "react";
import type { TextInput } from "react-native";
import React, { use, useRef, useState } from "react";
import { ActionSheetIOS, Image, Pressable, Text, View } from "react-native";
import { DragList } from "@/components/drag-list/drag-list";
import { GlassCloseButton } from "@/components/glass";
import { useCancelButton } from "@/hooks/use-cancel-button";
import { usePhotoSourceSheet } from "@/hooks/use-photo-source-sheet";
import { useServerImage } from "@/lib/network/server-url";
import { useIntl } from "react-intl";

import type {
  IngredientSuggestion,
  LineMoves,
  ParsedIngredient,
  Step,
  StepRow,
} from "@norish/shared-react/recipes";
import type { MeasurementSystem } from "@norish/shared/contracts";
import {
  chipLinesOf,
  createStepRow,
  hasStepContent,
  ingredientSuggestionsOf,
  ingredientTriggerAt,
  isHeadingText,
  matchIngredientSuggestions,
  mentionIngredient,
  normalizeStepRows,
  remapStepRefs,
  removeStepRow,
  replaceTrigger,
  rowNumbers,
  seedStepRows,
  stepChipLabel,
  stepRowsToSteps,
  typeStepRow,
} from "@norish/shared-react/recipes";

import type { useEditorUploads } from "../../hooks/use-editor-uploads";
import { FocusedFieldContext } from "../../hooks/use-focused-field-in-view";
import { IngredientIcon } from "../ingredient-icon";
import { AddRow, DragGrip, EditorInput, RowIconButton } from "./editor-parts";
import { useFoodsByName } from "./use-foods-by-name";

const STEP_PHOTO = {
  mediaTypes: ["images"],
  quality: 0.9,
} satisfies ImagePicker.ImagePickerOptions;

/** A step's share presets, as web's chip menu lists them. */
const SHARES = [
  ["full", 1],
  ["half", 0.5],
  ["third", 1 / 3],
  ["quarter", 0.25],
] as const;

/**
 * A numbered row per step with a grip, `#` sections, the `@` popup that links a line to the
 * step, its chips, and step photos from the library or the camera.
 */
export function StepRows({
  steps,
  ingredients,
  systemUsed,
  uploads,
  lineMoves,
  onChange,
}: {
  steps: Step[];
  ingredients: ParsedIngredient[];
  systemUsed: MeasurementSystem;
  uploads: ReturnType<typeof useEditorUploads>;
  /** The last move of the ingredient lines, which the steps' references follow. */
  lineMoves: LineMoves | null;
  onChange: (steps: Step[]) => void;
}) {
  const intl = useIntl();
  const cancel = useCancelButton();
  const toImage = useServerImage();
  const reportFocus = use(FocusedFieldContext);
  const [rows, setRows] = useState<StepRow[]>(() => seedStepRows(steps));
  const [seededLength, setSeededLength] = useState(steps.length);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [revealedId, setRevealedId] = useState<string | null>(null);
  // The focused row's caret, so the `@` popup reads the text before it.
  const [caret, setCaret] = useState<{ rowId: string; at: number } | null>(null);
  const [photoRowId, setPhotoRowId] = useState<string | null>(null);
  const inputsRef = useRef(new Map<string, ComponentRef<typeof TextInput>>());
  const text = (id: string, values?: Record<string, string>) => intl.formatMessage({ id }, values);

  if (steps.length !== seededLength) {
    setSeededLength(steps.length);
    if (steps.length > 0 && rows.length === 1 && !hasStepContent(rows[0]!)) {
      setRows(seedStepRows(steps));
    }
  }

  // The form already moved its copy of the references; the rows' copy follows once per move.
  const [appliedMoves, setAppliedMoves] = useState(lineMoves);

  if (lineMoves !== appliedMoves) {
    setAppliedMoves(lineMoves);
    if (lineMoves) {
      setRows(
        rows.map((row) => ({
          ...row,
          stepIngredients: remapStepRefs(row.stepIngredients, lineMoves),
        }))
      );
    }
  }

  const chipLines = chipLinesOf(ingredients, systemUsed);
  const suggestions = ingredientSuggestionsOf(chipLines);
  // The rows above already load these icons; a line names its food the same way here.
  const foods = useFoodsByName(suggestions.map((suggestion) => suggestion.label));
  const commit = (next: StepRow[]) => {
    setRows(next);
    onChange(stepRowsToSteps(next, systemUsed));
  };
  const indexOf = (rowId: string) => rows.findIndex((row) => row.id === rowId);
  const update = (rowId: string, patch: Partial<StepRow>) => {
    const index = indexOf(rowId);
    const row = rows[index];

    if (!row) return;
    commit(rows.with(index, { ...row, ...patch }));
  };

  const pickPhotos = usePhotoSourceSheet(text("recipes.editor.addStepPhoto"), (assets) => {
    const rowId = photoRowId;

    if (!rowId) return;
    const row = rows[indexOf(rowId)];

    void uploads.uploadStep(assets, row?.images.length ?? 0).then((added) => {
      // The rows may have moved on while uploading, so the photos join the row as it is now.
      setRows((current) => {
        const next = current.map((entry) =>
          entry.id === rowId ? { ...entry, images: [...entry.images, ...added] } : entry
        );

        onChange(stepRowsToSteps(next, systemUsed));

        return next;
      });
    });
  });

  const trailing = rows.at(-1);
  const shown = rows.filter(
    (row) =>
      row !== trailing ||
      rows.length === 1 ||
      row.id === focusedId ||
      row.id === revealedId ||
      hasStepContent(row)
  );
  const numbers = rowNumbers(rows.map((row) => row.text));

  const mentionIn = (row: StepRow) => {
    if (focusedId !== row.id || caret?.rowId !== row.id || suggestions.length === 0) return null;

    return ingredientTriggerAt(row.text, Math.min(caret.at, row.text.length));
  };
  const pickMention = (row: StepRow, suggestion: IngredientSuggestion) => {
    const match = mentionIn(row);

    if (!match) return;
    const inserted = replaceTrigger(row.text, match, suggestion.label);

    commit(mentionIngredient(rows, rows.indexOf(row), suggestion, inserted.text, chipLines).rows);
    setCaret({ rowId: row.id, at: inserted.caret });
  };
  const editChip = (rowId: string, ingredientOrder: number) => {
    const row = rows[indexOf(rowId)];
    const line = chipLines.find((candidate) => candidate.order === ingredientOrder);

    if (!row || !line) return;
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
        const refs =
          choice === SHARES.length
            ? row.stepIngredients.filter((ref) => ref.ingredientOrder !== ingredientOrder)
            : share === undefined
              ? null
              : row.stepIngredients.map((ref) =>
                  ref.ingredientOrder === ingredientOrder ? { ...ref, share } : ref
                );

        if (refs) update(rowId, { stepIngredients: refs });
      }
    );
  };
  const leaveRow = (rowId: string) => {
    setFocusedId(null);
    const index = indexOf(rowId);
    const row = rows[index];

    if (row && !hasStepContent(row) && index < rows.length - 1) commit(removeStepRow(rows, index));
  };
  const focusNext = (index: number) => {
    const next = rows[index + 1];

    if (!next) return;
    if (next === trailing) setRevealedId(next.id);
    inputsRef.current.get(next.id)?.focus();
  };

  const renderRow = (row: StepRow, drag: () => void) => {
    const index = rows.indexOf(row);
    const heading = isHeadingText(row.text);
    const number = numbers[index];
    const match = mentionIn(row);
    const matches = match ? matchIngredientSuggestions(suggestions, match.query) : [];

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
            ref={(input) => {
              if (input) inputsRef.current.set(row.id, input);
              else inputsRef.current.delete(row.id);
            }}
            multiline
            accessibilityLabel={text(
              heading ? "recipes.editor.sectionHeading" : "recipes.editor.step"
            )}
            autoFocus={row.id === revealedId}
            className={`text-foreground py-0 text-[17px] leading-6 ${heading ? "font-semibold" : ""}`}
            placeholder={
              rows.length === 1 ? text("recipes.stepInput.stepPlaceholder", { number: "1" }) : ""
            }
            returnKeyType="next"
            submitBehavior="submit"
            testID={`editor-step-input-${index}`}
            value={row.text}
            onBlur={() => leaveRow(row.id)}
            onChangeText={(value) => commit(typeStepRow(rows, index, value))}
            onFocus={() => setFocusedId(row.id)}
            onSelectionChange={({ nativeEvent }) =>
              setCaret({ rowId: row.id, at: nativeEvent.selection.start })
            }
            onSubmitEditing={() => focusNext(index)}
          />
          {matches.length > 0 ? (
            <View
              accessibilityLabel={text("recipes.stepInput.ingredientSuggestions")}
              className="bg-surface border-border overflow-hidden rounded-2xl border shadow-lg"
              testID="editor-mention-popup"
              // The popup opens under the field, so it brings itself clear of the keyboard and pill.
              onLayout={(event) => {
                if (typeof event.currentTarget !== "number") reportFocus?.(event.currentTarget);
              }}
            >
              {matches.map((suggestion, position) => (
                <Pressable
                  key={suggestion.key}
                  accessibilityRole="button"
                  className={`min-h-11 flex-row items-center gap-2.5 px-3.5 ${position === 0 ? "" : "border-separator border-t"}`}
                  testID={`editor-mention-${suggestion.ingredientOrder}`}
                  onPress={() => pickMention(row, suggestion)}
                >
                  <IngredientIcon ingredientId={foods.get(suggestion.label) ?? null} size={22} />
                  <Text className="text-foreground text-base">{suggestion.label}</Text>
                </Pressable>
              ))}
            </View>
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
                    onPress={() => editChip(row.id, ref.ingredientOrder)}
                  >
                    <IngredientIcon
                      ingredientId={foods.get(line.ingredientName) ?? null}
                      size={18}
                    />
                    <Text className="text-foreground text-[13px] font-medium">
                      {stepChipLabel(line, ref.share)}
                    </Text>
                  </Pressable>
                ) : null;
              })}
            </View>
          ) : null}
          {row.images.length > 0 ? (
            <View className="flex-row flex-wrap gap-2">
              {row.images.map((image, imageIndex) => (
                // The same picture can sit here twice, so only its place tells the two apart.
                // eslint-disable-next-line @eslint-react/no-array-index-key
                <View key={imageIndex} className="size-16">
                  <Image
                    className="size-16 rounded-xl"
                    source={toImage(image.image)}
                    style={{ width: 64, height: 64, borderRadius: 12 }}
                  />
                  <View className="absolute -top-1.5 -right-1.5">
                    <GlassCloseButton
                      label={text("recipes.editor.removePhoto")}
                      size="small"
                      testID={`editor-step-photo-remove-${index}-${imageIndex}`}
                      onPress={() => {
                        uploads.removeStepImage(image.image);
                        update(row.id, {
                          images: row.images
                            .filter((_, i) => i !== imageIndex)
                            .map((kept, order) => ({ ...kept, order })),
                        });
                      }}
                    />
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        <View className="items-center">
          {heading ? null : (
            <RowIconButton
              icon="image-outline"
              label={text("recipes.editor.addStepPhoto")}
              testID={`editor-step-photo-${index}`}
              onPress={() => {
                if (!uploads.canUpload()) return;
                setPhotoRowId(row.id);
                pickPhotos(STEP_PHOTO);
              }}
            />
          )}
          {focusedId === row.id && hasStepContent(row) ? (
            <RowIconButton
              icon="close-circle"
              label={text("recipes.editor.removeStep")}
              testID={`editor-step-remove-${index}`}
              onPress={() => {
                row.images.forEach((image) => uploads.removeStepImage(image.image));
                commit(removeStepRow(rows, index));
              }}
            />
          ) : hasStepContent(row) ? (
            <DragGrip label={text("recipes.gallery.dragToReorder")} onDrag={drag} />
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View>
      <DragList
        nested
        // A tap on a row's buttons or the `@` popup keeps the keyboard, as the page does.
        keyboardShouldPersistTaps="handled"
        renderHeading={() => null}
        renderItem={renderRow}
        rows={shown.map((row) => ({ kind: "item" as const, key: row.id, value: row }))}
        onDrop={(drop) => commit(normalizeStepRows(drop.rows.map((entry) => entry.value)))}
      />
      {shown.includes(trailing!) ? null : (
        <AddRow
          label={text("recipes.editor.addStep")}
          testID="editor-add-step"
          onPress={() => setRevealedId((rows.at(-1) ?? createStepRow("")).id)}
        />
      )}
    </View>
  );
}
