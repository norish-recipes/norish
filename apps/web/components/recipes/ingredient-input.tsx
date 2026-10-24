"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  IngredientIcon,
  IngredientIconsProvider,
  useFoodsByName,
} from "@/components/ingredients/ingredient-icon";
import SmartTextInput from "@/components/shared/smart-text-input";
import { useUnitsQuery } from "@/hooks/config";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { Reorder, useDragControls } from "motion/react";
import { useTranslations } from "next-intl";

import { MeasurementSystem } from "@norish/shared/contracts";
import { debounce, parseIngredientWithDefaults } from "@norish/shared/lib/helpers";
import { namesNoFood } from "@norish/shared/lib/ingredient-text";

export interface ParsedIngredient {
  id?: string;
  version?: number;
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
  recipeIngredientId?: string;
  version?: number;
}
let nextId = 0;
function createItem(
  text: string,
  meta?: Pick<IngredientItem, "recipeIngredientId" | "version">
): IngredientItem {
  return {
    id: `ing-${nextId++}`,
    text,
    ...meta,
  };
}
// The editor's rows for the given ingredients, plus the empty row to type into.
function seedItems(ingredients: ParsedIngredient[]): IngredientItem[] {
  const formatted = ingredients.map((ing) => {
    const parts: string[] = [];
    if (ing.amount !== null) parts.push(String(ing.amount));
    if (ing.unit) parts.push(ing.unit);
    if (ing.ingredientName) parts.push(ing.ingredientName);
    return createItem(parts.join(" "), {
      recipeIngredientId: ing.id,
      version: ing.version,
    });
  });
  return [...formatted, createItem("")];
}
export default function IngredientInput({
  ingredients,
  onChange,
  systemUsed = "metric",
  onSystemDetected: _onSystemDetected,
}: IngredientInputProps) {
  const { units } = useUnitsQuery();
  const t = useTranslations("recipes.ingredientInput");
  const [items, setItems] = useState<IngredientItem[]>(() => seedItems(ingredients));
  const [seededLength, setSeededLength] = useState(ingredients.length);
  const textareasRef = useRef<(HTMLTextAreaElement | null)[]>([]);
  const dragConstraintsRef = useRef<HTMLUListElement>(null);

  // Seeds the editor once when the ingredients load; a later change to them
  // must not overwrite what is being typed.
  if (ingredients.length !== seededLength) {
    setSeededLength(ingredients.length);
    const first = items[0];

    if (first && ingredients.length > 0 && items.length === 1 && first.text === "") {
      setItems(seedItems(ingredients));
    }
  }
  const parseIngredient = useCallback(
    (item: IngredientItem, order: number): ParsedIngredient | null => {
      const trimmed = item.text.trim();
      if (!trimmed) return null;
      const first = parseIngredientWithDefaults(trimmed, units)?.[0];

      if (!first) {
        // Fallback: treat entire text as ingredient name
        return {
          id: item.recipeIngredientId,
          version: item.version,
          ingredientName: trimmed,
          amount: null,
          unit: null,
          order,
          systemUsed,
        };
      }
      return {
        id: item.recipeIngredientId,
        version: item.version,
        ingredientName: first.description || trimmed,
        amount: first.quantity ? Number(first.quantity) : null,
        unit: first.unitOfMeasure || null,
        order,
        systemUsed,
      };
    },
    [systemUsed, units]
  );
  const flushParse = useCallback(
    (updatedItems: IngredientItem[]) => {
      const parsed = updatedItems
        .map((item, idx) => parseIngredient(item, idx))
        .filter((ing): ing is ParsedIngredient => ing !== null);
      onChange(parsed);
    },
    [parseIngredient, onChange]
  );
  const debouncedParse = useCallback(
    (updatedItems: IngredientItem[]) => {
      const doUpdate = debounce(flushParse, 300);
      doUpdate(updatedItems);
    },
    [flushParse]
  );
  const handleInputChange = useCallback(
    (index: number, value: string) => {
      const current = items[index];

      if (!current) return;
      const updated = [...items];

      updated[index] = {
        ...current,
        text: value,
      };

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
          textareasRef.current[index + 1]?.focus();
        } else {
          const updated = [...items, createItem("")];
          setItems(updated);
          setTimeout(() => {
            textareasRef.current[items.length]?.focus();
          }, 0);
        }
      } else if (e.key === "Backspace" && !items[index]?.text && index > 0) {
        e.preventDefault();
        const updated = items.filter((_, i) => i !== index);
        setItems(updated);
        debouncedParse(updated);
        setTimeout(() => {
          textareasRef.current[index - 1]?.focus();
        }, 0);
      }
    },
    [items, debouncedParse]
  );
  const handleBlur = useCallback(
    (index: number) => {
      // Auto-remove empty rows on blur (except the last one)
      if (!items[index]?.text.trim() && index < items.length - 1) {
        const updated = items.filter((_, i) => i !== index);
        if (updated.length === 0) updated.push(createItem(""));
        setItems(updated);
        flushParse(updated);
      } else {
        // Leaving the field commits the pending parse immediately, so a submit
        // inside the debounce window cannot lose what was just typed.
        flushParse(items);
      }
    },
    [items, flushParse]
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
      const normalized = normalizeIngredientItems(newOrder);
      setItems(normalized);
      debouncedParse(normalized);
    },
    [debouncedParse]
  );

  // The food each row names, read as Save will read it, for the row's icon.
  const foodNames = items.map((item, index) => {
    const name = parseIngredient(item, index)?.ingredientName ?? "";

    return namesNoFood(name) ? "" : name;
  });
  const foods = useFoodsByName(foodNames);

  // Calculate ingredient numbers (excluding headings)
  const getIngredientNumber = (index: number): number | null => {
    const isHeading = (item: IngredientItem) => item.text.trim().startsWith("#");
    const item = items[index];

    if (!item || isHeading(item)) return null;

    return items.slice(0, index + 1).filter((it) => !isHeading(it)).length;
  };
  return (
    <IngredientIconsProvider ids={[...foods.values()]}>
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
            ingredientNumber={getIngredientNumber(index)}
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
    </IngredientIconsProvider>
  );
}
function normalizeIngredientItems(next: IngredientItem[]): IngredientItem[] {
  const withoutTrailingEmpty = next.filter((it) => it.text.trim().length > 0);
  const normalized = [...withoutTrailingEmpty, createItem("")];
  return normalized.length ? normalized : [createItem("")];
}

// Separate component for each row to use useDragControls
interface IngredientRowProps {
  item: IngredientItem;
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
