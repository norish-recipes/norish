import type * as ImagePicker from "expo-image-picker";
import React, { useLayoutEffect, useRef, useState } from "react";
import { View } from "react-native";
import { DragList } from "@/components/drag-list/drag-list";
import { usePhotoSourceSheet } from "@/hooks/use-photo-source-sheet";
import { useIntl } from "react-intl";

import type {
  LineMoves,
  ParsedIngredient,
  Step,
  StepRow as StepRowValue,
} from "@norish/shared-react/recipes";
import type { MeasurementSystem } from "@norish/shared/contracts";
import { useFoodsByName } from "@norish/shared-react/ingredients";
import {
  chipLinesOf,
  hasStepContent,
  inDraggedOrder,
  ingredientSuggestionsOf,
  mentionIngredient,
  normalizeStepRows,
  removeStepRow,
  rowNumbers,
  seedStepRows,
  stepRowsToSteps,
  typeStepRow,
  withStepRefsOf,
} from "@norish/shared-react/recipes";

import type { useEditorUploads } from "../../hooks/use-editor-uploads";
import { useTrailingRow } from "../../hooks/use-trailing-row";
import { AddRow } from "./editor-parts";
import { StepRow } from "./step-row";

const STEP_PHOTO = {
  mediaTypes: ["images"],
  quality: 0.9,
} satisfies ImagePicker.ImagePickerOptions;

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
  /** The last move of the ingredient lines, after which the rows take the form's references. */
  lineMoves: LineMoves | null;
  onChange: (steps: Step[]) => void;
}) {
  const intl = useIntl();
  const [rows, setRows] = useState<StepRowValue[]>(() => seedStepRows(steps));
  // The rows as last changed, which a render may not show yet when an upload ends.
  const latestRowsRef = useRef(rows);
  const [seededLength, setSeededLength] = useState(steps.length);
  // Rows set while rendering (seeded, references taken back), for the ref once committed.
  const [adopted, setAdopted] = useState<StepRowValue[] | null>(null);
  const trailingRow = useTrailingRow(rows, hasStepContent);
  const text = (id: string) => intl.formatMessage({ id });

  if (steps.length !== seededLength) {
    setSeededLength(steps.length);
    if (steps.length > 0 && rows.length === 1 && !hasStepContent(rows[0]!)) {
      const seeded = seedStepRows(steps);

      setRows(seeded);
      setAdopted(seeded);
    }
  }

  // The form moved the references; the rows take them from it once lines have moved.
  const [appliedMoves, setAppliedMoves] = useState(lineMoves);

  if (lineMoves !== appliedMoves) {
    setAppliedMoves(lineMoves);
    if (lineMoves) {
      const taken = withStepRefsOf(rows, steps);

      setRows(taken);
      setAdopted(taken);
    }
  }
  useLayoutEffect(() => {
    if (adopted) latestRowsRef.current = adopted;
  }, [adopted]);

  const chipLines = chipLinesOf(ingredients, systemUsed);
  const suggestions = ingredientSuggestionsOf(chipLines);
  // The rows above already load these icons; a line names its food the same way here.
  const foods = useFoodsByName(suggestions.map((suggestion) => suggestion.label));
  const numbers = rowNumbers(rows.map((row) => row.text));
  const commit = (change: (current: StepRowValue[]) => StepRowValue[]) => {
    const next = change(latestRowsRef.current);

    latestRowsRef.current = next;
    setRows(next);
    onChange(stepRowsToSteps(next, systemUsed));
  };
  const update = (index: number, patch: (row: StepRowValue) => Partial<StepRowValue>) =>
    commit((current) => {
      const row = current[index];

      return row ? current.with(index, { ...row, ...patch(row) }) : current;
    });

  const pickPhotos = usePhotoSourceSheet(text("recipes.editor.addStepPhoto"));
  const addPhotos = (row: StepRowValue, assets: ImagePicker.ImagePickerAsset[]) => {
    void uploads.uploadStep(assets, row.id).then((added) => {
      // The rows may have moved on while uploading, so the photos join the row as it is now.
      commit((current) =>
        current.map((entry) =>
          entry.id === row.id
            ? {
                ...entry,
                images: [
                  ...entry.images,
                  ...added.map((image, index) => ({
                    ...image,
                    order: entry.images.length + index,
                  })),
                ],
              }
            : entry
        )
      );
    });
  };

  const renderRow = (row: StepRowValue, drag: () => void) => {
    const index = rows.indexOf(row);

    return (
      <StepRow
        chipLines={chipLines}
        drag={drag}
        focused={trailingRow.focusedId === row.id}
        foods={foods}
        index={index}
        inputProps={trailingRow.inputProps(row, index)}
        isOnlyRow={rows.length === 1}
        number={numbers[index] ?? null}
        pendingPhotos={uploads.pendingFor(row.id)}
        row={row}
        suggestions={suggestions}
        onAddPhoto={() => {
          if (uploads.canUpload()) pickPhotos(STEP_PHOTO, (assets) => addPhotos(row, assets));
        }}
        onCancelPhoto={uploads.cancel}
        onLeave={() => {
          const next = trailingRow.leave(index);

          if (next) commit(() => next);
        }}
        onMention={(suggestion, mentioned) =>
          commit(
            (current) => mentionIngredient(current, index, suggestion, mentioned, chipLines).rows
          )
        }
        onRefsChange={(stepIngredients) => update(index, () => ({ stepIngredients }))}
        onRemove={() => {
          row.images.forEach((image) => uploads.removeStepImage(image.image));
          uploads.pendingFor(row.id).forEach((photo) => uploads.cancel(photo.key));
          commit((current) => removeStepRow(current, index));
        }}
        onRemovePhoto={(imageIndex) => {
          const image = row.images[imageIndex];

          if (image) uploads.removeStepImage(image.image);
          update(index, (current) => ({
            images: current.images
              .filter((_, i) => i !== imageIndex)
              .map((kept, order) => ({ ...kept, order })),
          }));
        }}
        onType={(value) => commit((current) => typeStepRow(current, index, value))}
      />
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
        rows={trailingRow.visibleRows.map((row) => ({
          kind: "item" as const,
          key: row.id,
          value: row,
        }))}
        onDrop={(drop) =>
          commit((current) =>
            normalizeStepRows(
              inDraggedOrder(
                drop.rows.map((entry) => entry.value),
                current
              )
            )
          )
        }
      />
      {trailingRow.canAdd ? (
        <AddRow
          label={text("recipes.editor.addStep")}
          testID="editor-add-step"
          onPress={trailingRow.add}
        />
      ) : null}
    </View>
  );
}
