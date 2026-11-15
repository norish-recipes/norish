"use client";

import React, { useRef, useState } from "react";
import { IngredientIcon } from "@/components/ingredients/ingredient-icon";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { Reorder, useDragControls } from "motion/react";
import { useTranslations } from "next-intl";

import type { IngredientRow, LineMoves, ParsedIngredient } from "@norish/shared-react/recipes";
import type { MeasurementSystem } from "@norish/shared/contracts";
import { useUnitsQuery } from "@norish/shared-react/config";
import { useFoodsByName, useIngredientIcons } from "@norish/shared-react/ingredients";
import {
  createIngredientRow,
  hasIngredientContent,
  inDraggedOrder,
  ingredientRowsToLines,
  lineMoves,
  normalizeIngredientRows,
  parseIngredientRow,
  removeIngredientRow,
  rowNumbers,
  rowsAfterLeaving,
  seedIngredientRows,
  typeIngredientRow,
} from "@norish/shared-react/recipes";
import { debounce } from "@norish/shared/lib/helpers";
import { namesNoFood } from "@norish/shared/lib/ingredient-text";

import SmartTextInput from "./smart-text-input";

export type { ParsedIngredient } from "@norish/shared-react/recipes";

interface IngredientInputProps {
  ingredients: ParsedIngredient[];
  onChange: (ingredients: ParsedIngredient[]) => void;
  systemUsed?: MeasurementSystem;
  onSystemDetected?: (system: MeasurementSystem) => void;
  /** Lines were reordered or removed, so the steps' references can follow them. */
  onLinesMoved?: (moves: LineMoves) => void;
}

export default function IngredientInput({
  ingredients,
  onChange,
  systemUsed = "metric",
  onSystemDetected: _onSystemDetected,
  onLinesMoved,
}: IngredientInputProps) {
  const { units } = useUnitsQuery();
  const t = useTranslations("recipes.ingredientInput");
  const [items, setItems] = useState<IngredientRow[]>(() => seedIngredientRows(ingredients));
  const [seededLength, setSeededLength] = useState(ingredients.length);
  const textareasRef = useRef<(HTMLTextAreaElement | null)[]>([]);
  const dragConstraintsRef = useRef<HTMLUListElement>(null);

  // Seeds the editor once when the ingredients load; a later change to them
  // must not overwrite what is being typed.
  if (ingredients.length !== seededLength) {
    setSeededLength(ingredients.length);
    const first = items[0];

    if (first && ingredients.length > 0 && items.length === 1 && first.text === "") {
      setItems(seedIngredientRows(ingredients));
    }
  }
  const flushParse = (updatedItems: IngredientRow[]) => {
    onChange(ingredientRowsToLines(updatedItems, units, systemUsed));
  };
  const debouncedParse = (updatedItems: IngredientRow[]) => {
    const doUpdate = debounce(flushParse, 300);
    doUpdate(updatedItems);
  };
  // The rows after a reorder or a removal, reporting where each line went.
  const moveRows = (updated: IngredientRow[]) => {
    const moves = lineMoves(items, updated);

    setItems(updated);
    if (moves) onLinesMoved?.(moves);
  };
  const handleInputChange = (index: number, value: string) => {
    const updated = typeIngredientRow(items, index, value);

    if (updated === items) return;
    setItems(updated);
    debouncedParse(updated);
  };
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Move to next input or create new one
      if (index < items.length - 1) {
        textareasRef.current[index + 1]?.focus();
      } else {
        const updated = [...items, createIngredientRow("")];
        setItems(updated);
        setTimeout(() => {
          textareasRef.current[items.length]?.focus();
        }, 0);
      }
    } else if (e.key === "Backspace" && !items[index]?.text && index > 0) {
      e.preventDefault();
      const updated = items.filter((_, i) => i !== index);
      moveRows(updated);
      debouncedParse(updated);
      setTimeout(() => {
        textareasRef.current[index - 1]?.focus();
      }, 0);
    }
  };
  const handleBlur = (index: number) => {
    const updated = rowsAfterLeaving(items, index, hasIngredientContent);

    if (updated !== items) moveRows(updated);
    // Leaving the field commits the pending parse immediately, so a submit
    // inside the debounce window cannot lose what was just typed.
    flushParse(updated);
  };
  const handleRemove = (index: number) => {
    const updated = removeIngredientRow(items, index);

    moveRows(updated);
    debouncedParse(updated);
  };
  const handleReorder = (newOrder: IngredientRow[]) => {
    const normalized = normalizeIngredientRows(inDraggedOrder(newOrder, items));
    moveRows(normalized);
    debouncedParse(normalized);
  };

  // The food each row names, read as Save will read it, for the row's icon.
  const foodNames = items.map((item, index) => {
    const name = parseIngredientRow(item, index, units, systemUsed)?.ingredientName ?? "";

    return namesNoFood(name) ? "" : name;
  });
  const foods = useFoodsByName(foodNames);

  useIngredientIcons([...foods.values()]);

  // Lines are numbered past the section headings.
  const numbers = rowNumbers(items.map((item) => item.text));

  return (
    <Reorder.Group
      ref={dragConstraintsRef}
      axis="y"
      className="flex flex-col gap-2"
      values={items}
      onReorder={handleReorder}
    >
      {items.map((item, index) => (
        <IngredientRow
          key={item.id}
          dragConstraintsRef={dragConstraintsRef}
          foodId={foods.get(foodNames[index] ?? "") ?? null}
          index={index}
          ingredientNumber={numbers[index] ?? null}
          ingredientPlaceholder={t("placeholder")}
          isLast={index === items.length - 1}
          item={item}
          showRemove={items.length > 1 && !!item.text}
          onBlur={() => handleBlur(index)}
          onKeyDown={(e) =>
            handleKeyDown(index, e as unknown as React.KeyboardEvent<HTMLInputElement>)
          }
          onRemove={() => handleRemove(index)}
          onValueChange={(v) => handleInputChange(index, v)}
        />
      ))}
    </Reorder.Group>
  );
}
// Separate component for each row to use useDragControls
interface IngredientRowProps {
  item: IngredientRow;
  index: number;
  /** The food the row's text names, for its icon; null shows the placeholder. */
  foodId: string | null;
  ingredientNumber: number | null;
  isLast: boolean;
  showRemove: boolean;
  dragConstraintsRef: React.RefObject<HTMLUListElement | null>;
  ingredientPlaceholder: string;
  onValueChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur: () => void;
  onRemove: () => void;
}
function IngredientRow({
  item,
  index,
  foodId,
  ingredientNumber,
  isLast,
  showRemove,
  dragConstraintsRef,
  ingredientPlaceholder,
  onValueChange,
  onKeyDown,
  onBlur,
  onRemove,
}: IngredientRowProps) {
  const controls = useDragControls();
  const canDrag = !isLast && !!item.text.trim();
  return (
    <Reorder.Item
      className="flex items-start gap-2"
      drag={canDrag ? "y" : false}
      dragConstraints={dragConstraintsRef}
      dragControls={controls}
      dragElastic={0}
      dragListener={false}
      dragMomentum={false}
      style={{
        position: "relative",
      }}
      value={item}
    >
      {/* Drag handle - only show for non-empty, non-last items */}
      <div
        className={`flex h-10 w-6 flex-shrink-0 touch-none items-center justify-center ${!isLast && item.text ? "cursor-grab active:cursor-grabbing" : ""}`}
        onPointerDown={(e) => {
          if (canDrag) {
            controls.start(e);
          }
        }}
      >
        {canDrag ? <Bars3Icon className="text-muted h-4 w-4" /> : null}
      </div>

      {/* Ingredient number */}
      <div className="text-muted flex h-10 w-6 flex-shrink-0 items-center justify-center font-medium">
        {ingredientNumber !== null ? `${ingredientNumber}.` : ""}
      </div>

      {/* The food's icon; a heading names no food and gets none. */}
      {ingredientNumber !== null ? <IngredientIcon className="mt-1" ingredientId={foodId} /> : null}

      {/* Input field */}
      <div className="flex-1">
        <SmartTextInput
          minRows={1}
          placeholder={index === 0 ? ingredientPlaceholder : ""}
          value={item.text}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onValueChange={onValueChange}
        />
      </div>

      {/* Remove button */}
      <div className="mt-1 h-8 w-8 min-w-8 flex-shrink-0">
        {showRemove && (
          <Button
            isIconOnly
            className="h-full w-full"
            size="sm"
            onPress={onRemove}
            variant="tertiary"
          >
            <XMarkIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Reorder.Item>
  );
}
