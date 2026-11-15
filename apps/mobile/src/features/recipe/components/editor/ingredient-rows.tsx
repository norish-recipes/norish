import React, { useState } from "react";
import { View } from "react-native";
import { DragList } from "@/components/drag-list/drag-list";
import { IngredientIcon } from "@/components/ingredient-icon";
import { useIntl } from "react-intl";

import type { IngredientRow, LineMoves, ParsedIngredient } from "@norish/shared-react/recipes";
import type { MeasurementSystem } from "@norish/shared/contracts";
import { useUnitsQuery } from "@norish/shared-react/config";
import { useFoodsByName, useIngredientIcons } from "@norish/shared-react/ingredients";
import {
  hasIngredientContent,
  ingredientRowsToLines,
  isHeadingText,
  lineMoves,
  normalizeIngredientRows,
  parseIngredientRow,
  removeIngredientRow,
  seedIngredientRows,
  typeIngredientRow,
} from "@norish/shared-react/recipes";
import { namesNoFood } from "@norish/shared/lib/ingredient-text";

import { useTrailingRow } from "../../hooks/use-trailing-row";
import { AddRow, DragGrip, EditorInput, RowIconButton } from "./editor-parts";

/**
 * A row per ingredient line with a grip; `#` starts a section. The trailing empty row to type
 * into shows on a new recipe or once Add ingredient asks for it.
 */
export function IngredientRows({
  ingredients,
  systemUsed,
  onChange,
  onLinesMoved,
}: {
  ingredients: ParsedIngredient[];
  systemUsed: MeasurementSystem;
  onChange: (ingredients: ParsedIngredient[]) => void;
  /** Lines were reordered or removed, so the steps' references can follow them. */
  onLinesMoved: (moves: LineMoves) => void;
}) {
  const intl = useIntl();
  const { units } = useUnitsQuery();
  const [rows, setRows] = useState<IngredientRow[]>(() => seedIngredientRows(ingredients));
  const [seededLength, setSeededLength] = useState(ingredients.length);
  const trailingRow = useTrailingRow(rows, hasIngredientContent);

  // Seeds once when an edit's lines arrive; a later change must not overwrite what is typed.
  if (ingredients.length !== seededLength) {
    setSeededLength(ingredients.length);
    if (ingredients.length > 0 && rows.length === 1 && rows[0]?.text === "") {
      setRows(seedIngredientRows(ingredients));
    }
  }

  const commit = (next: IngredientRow[]) => {
    const moves = lineMoves(rows, next);

    setRows(next);
    if (moves) onLinesMoved(moves);
    onChange(ingredientRowsToLines(next, units, systemUsed));
  };

  const foodNames = rows.map((row, index) => {
    const name = parseIngredientRow(row, index, units, systemUsed)?.ingredientName ?? "";

    return namesNoFood(name) || isHeadingText(name) ? "" : name;
  });
  const foods = useFoodsByName(foodNames);

  useIngredientIcons([...foods.values()]);

  const renderRow = (row: IngredientRow, drag: () => void) => {
    const index = rows.indexOf(row);
    const heading = isHeadingText(row.text);
    const focused = trailingRow.focusedId === row.id;
    const filled = hasIngredientContent(row);

    return (
      <View
        className={`min-h-12 flex-row items-center gap-2.5 py-2 ${index === 0 ? "" : "border-separator border-t"}`}
        testID={`editor-ingredient-${index}`}
      >
        <View className="w-7 items-center">
          {heading ? null : (
            <IngredientIcon ingredientId={foods.get(foodNames[index] ?? "") ?? null} />
          )}
        </View>
        <View className="flex-1">
          <EditorInput
            {...trailingRow.inputProps(row, index)}
            multiline
            accessibilityLabel={intl.formatMessage({
              id: heading ? "recipes.editor.sectionHeading" : "recipes.editor.ingredient",
            })}
            className={`text-foreground py-0 text-[17px] leading-6 ${heading ? "font-semibold" : ""}`}
            placeholder={
              rows.length === 1
                ? intl.formatMessage({ id: "recipes.ingredientInput.placeholder" })
                : ""
            }
            returnKeyType="next"
            submitBehavior="submit"
            testID={`editor-ingredient-input-${index}`}
            value={row.text}
            onBlur={() => {
              const next = trailingRow.leave(index);

              if (next) commit(next);
            }}
            onChangeText={(text) => commit(typeIngredientRow(rows, index, text))}
          />
        </View>
        {focused && filled ? (
          <RowIconButton
            icon="close-circle"
            label={intl.formatMessage({ id: "recipes.editor.removeIngredient" })}
            testID={`editor-ingredient-remove-${index}`}
            onPress={() => commit(removeIngredientRow(rows, index))}
          />
        ) : filled ? (
          <DragGrip
            label={intl.formatMessage({ id: "recipes.gallery.dragToReorder" })}
            onDrag={drag}
          />
        ) : null}
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
        rows={trailingRow.visibleRows.map((row) => ({
          kind: "item" as const,
          key: row.id,
          value: row,
        }))}
        onDrop={(drop) => commit(normalizeIngredientRows(drop.rows.map((entry) => entry.value)))}
      />
      {trailingRow.canAdd ? (
        <AddRow
          label={intl.formatMessage({ id: "recipes.editor.addIngredient" })}
          testID="editor-add-ingredient"
          onPress={trailingRow.add}
        />
      ) : null}
    </View>
  );
}
