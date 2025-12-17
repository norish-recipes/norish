"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@heroui/react";
import { XMarkIcon, Bars3Icon } from "@heroicons/react/16/solid";
import { Reorder, useDragControls } from "motion/react";

import SmartTextInput from "@/components/shared/smart-text-input";
import { parseIngredientWithDefaults, debounce } from "@/lib/helpers";
import { useUnitsQuery } from "@/hooks/config";
import { MeasurementSystem } from "@/types";

export interface ParsedIngredient {
  ingredientName: string;
  amount: number | null;
  unit: string | null;
  order: number;
  systemUsed: MeasurementSystem;
}

export interface IngredientInputProps {
  ingredients: ParsedIngredient[];
  onChange: (ingredients: ParsedIngredient[]) => void;
  systemUsed?: MeasurementSystem;
  onSystemDetected?: (system: MeasurementSystem) => void;
}

// Internal type with stable IDs for reordering
interface IngredientItem {
  id: string;
  text: string;
}

let nextId = 0;
function createItem(text: string): IngredientItem {
  return { id: `ing-${nextId++}`, text };
}

export default function IngredientInput({
  ingredients,
  onChange,
  systemUsed = "metric",
  onSystemDetected: _onSystemDetected,
}: IngredientInputProps) {
  const { units } = useUnitsQuery();
  const [items, setItems] = useState<IngredientItem[]>([createItem("")]);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Initialize from ingredients prop
  useEffect(() => {
    if (ingredients.length > 0 && items.length === 1 && items[0].text === "") {
      const formatted = ingredients.map((ing) => {
        const parts: string[] = [];

        if (ing.amount !== null) parts.push(String(ing.amount));
        if (ing.unit) parts.push(ing.unit);
        if (ing.ingredientName) parts.push(ing.ingredientName);

        return createItem(parts.join(" "));
      });

      setItems([...formatted, createItem("")]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ingredients.length]);

  const parseIngredient = useCallback(
    (text: string, order: number): ParsedIngredient | null => {
      const trimmed = text.trim();

      if (!trimmed) return null;

      const parsed = parseIngredientWithDefaults(trimmed, units);

      if (!parsed || parsed.length === 0) {
        // Fallback: treat entire text as ingredient name
        return {
          ingredientName: trimmed,
          amount: null,
          unit: null,
          order,
          systemUsed,
        };
      }

      const first = parsed[0];

      return {
        ingredientName: first.description || trimmed,
        amount: first.quantity ? Number(first.quantity) : null,
        unit: first.unitOfMeasure || null,
        order,
        systemUsed,
      };
    },
    [systemUsed, units]
  );

  const debouncedParse = useCallback(
    (updatedItems: IngredientItem[]) => {
      const doUpdate = debounce((items: IngredientItem[]) => {
        const parsed = items
          .map((item, idx) => parseIngredient(item.text, idx))
          .filter((ing): ing is ParsedIngredient => ing !== null);

        onChange(parsed);
      }, 300);

      doUpdate(updatedItems);
    },
    [parseIngredient, onChange]
  );

  const handleInputChange = useCallback(
    (index: number, value: string) => {
      const updated = [...items];

      updated[index] = { ...updated[index], text: value };

      // Auto-add empty line at the end
      if (index === items.length - 1 && value.trim()) {
        updated.push(createItem(""));
      }

      setItems(updated);
      debouncedParse(updated);
    },
    [items, debouncedParse]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        // Move to next input or create new one
        if (index < items.length - 1) {
          textareaRefs.current[index + 1]?.focus();
        } else {
          const updated = [...items, createItem("")];

          setItems(updated);
          setTimeout(() => {
            textareaRefs.current[items.length]?.focus();
          }, 0);
        }
      } else if (e.key === "Backspace" && !items[index].text && index > 0) {
        e.preventDefault();
        const updated = items.filter((_, i) => i !== index);

        setItems(updated);
        debouncedParse(updated);
        setTimeout(() => {
          textareaRefs.current[index - 1]?.focus();
        }, 0);
      }
    },
    [items, debouncedParse]
  );

  const handleBlur = useCallback(
    (index: number) => {
      // Auto-remove empty rows on blur (except the last one)
      if (!items[index].text.trim() && index < items.length - 1) {
        const updated = items.filter((_, i) => i !== index);

        if (updated.length === 0) updated.push(createItem(""));
        setItems(updated);
        debouncedParse(updated);
      }
    },
    [items, debouncedParse]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const updated = items.filter((_, i) => i !== index);

      if (updated.length === 0) updated.push(createItem(""));
      setItems(updated);
      debouncedParse(updated);
    },
    [items, debouncedParse]
  );

  const handleReorder = useCallback(
    (newOrder: IngredientItem[]) => {
      setItems(newOrder);
      debouncedParse(newOrder);
    },
    [debouncedParse]
  );

  // Calculate ingredient numbers (excluding headings)
  const getIngredientNumber = (index: number): number | null => {
    let num = 0;
    for (let i = 0; i <= index; i++) {
      const isHeading = items[i].text.trim().startsWith("#");
      if (!isHeading) num++;
    }
    const isCurrentHeading = items[index].text.trim().startsWith("#");
    return isCurrentHeading ? null : num;
  };

  return (
    <Reorder.Group
      axis="y"
      values={items}
      onReorder={handleReorder}
      className="flex flex-col gap-2"
    >
      {items.map((item, index) => (
        <IngredientRow
          key={item.id}
          item={item}
          index={index}
          ingredientNumber={getIngredientNumber(index)}
          isLast={index === items.length - 1}
          showRemove={items.length > 1 && !!item.text}
          onValueChange={(v) => handleInputChange(index, v)}
          onKeyDown={(e) => handleKeyDown(index, e as unknown as React.KeyboardEvent<HTMLInputElement>)}
          onBlur={() => handleBlur(index)}
          onRemove={() => handleRemove(index)}
        />
      ))}
    </Reorder.Group>
  );
}

// Separate component for each row to use useDragControls
interface IngredientRowProps {
  item: IngredientItem;
  index: number;
  ingredientNumber: number | null;
  isLast: boolean;
  showRemove: boolean;
  onValueChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur: () => void;
  onRemove: () => void;
}

function IngredientRow({
  item,
  index,
  ingredientNumber,
  isLast,
  showRemove,
  onValueChange,
  onKeyDown,
  onBlur,
  onRemove,
}: IngredientRowProps) {
  const controls = useDragControls();

  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="flex items-start gap-2"
      style={{ position: "relative" }}
    >
      {/* Drag handle - only show for non-empty, non-last items */}
      <div
        className={`flex h-10 w-6 flex-shrink-0 touch-none items-center justify-center ${!isLast && item.text ? "cursor-grab active:cursor-grabbing" : ""
          }`}
        onPointerDown={(e) => {
          if (!isLast && item.text) {
            controls.start(e);
          }
        }}
      >
        {!isLast && item.text ? (
          <Bars3Icon className="text-default-400 h-4 w-4" />
        ) : null}
      </div>

      {/* Ingredient number */}
      <div className="text-default-500 flex h-10 w-6 flex-shrink-0 items-center justify-center font-medium">
        {ingredientNumber !== null ? `${ingredientNumber}.` : ""}
      </div>

      {/* Input field */}
      <div className="flex-1">
        <SmartTextInput
          minRows={1}
          placeholder={index === 0 ? "e.g., 2 cups flour" : ""}
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
            variant="light"
            onPress={onRemove}
          >
            <XMarkIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Reorder.Item>
  );
}
