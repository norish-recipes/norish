"use client";

import React, { useCallback, useRef, useState } from "react";
import {
  EquipmentIcon,
  EquipmentIconsProvider,
  useEquipmentByName,
} from "@/components/equipment/equipment-icon";
import SmartTextInput from "@/components/shared/smart-text-input";
import { Bars3Icon, XMarkIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { Reorder, useDragControls } from "motion/react";
import { useTranslations } from "next-intl";

import { debounce } from "@norish/shared/lib/helpers";
import { namesNoFood } from "@norish/shared/lib/ingredient-text";

export interface RecipeEquipmentFormItem {
  id?: string;
  version?: number;
  name: string;
  order: number;
}

export interface EquipmentInputProps {
  equipment: RecipeEquipmentFormItem[];
  onChange: (equipment: RecipeEquipmentFormItem[]) => void;
}

interface InternalEquipmentItem {
  id: string;
  text: string;
  recipeEquipmentId?: string;
  version?: number;
}

let nextId = 0;

function createItem(
  text: string,
  meta?: Pick<InternalEquipmentItem, "recipeEquipmentId" | "version">
): InternalEquipmentItem {
  return {
    id: `eq-${nextId++}`,
    text,
    ...meta,
  };
}

function seedItems(equipment: RecipeEquipmentFormItem[]): InternalEquipmentItem[] {
  const formatted = equipment.map((eq) =>
    createItem(eq.name, {
      recipeEquipmentId: eq.id,
      version: eq.version,
    })
  );

  return [...formatted, createItem("")];
}

export default function EquipmentInput({ equipment, onChange }: EquipmentInputProps) {
  const t = useTranslations("recipes.equipmentInput");
  const [items, setItems] = useState<InternalEquipmentItem[]>(() => seedItems(equipment));
  const [seededLength, setSeededLength] = useState(equipment.length);
  const textareasRef = useRef<(HTMLTextAreaElement | null)[]>([]);
  const dragConstraintsRef = useRef<HTMLUListElement>(null);

  if (equipment.length !== seededLength) {
    setSeededLength(equipment.length);
    const first = items[0];

    if (first && equipment.length > 0 && items.length === 1 && first.text === "") {
      setItems(seedItems(equipment));
    }
  }

  const parseLine = useCallback(
    (item: InternalEquipmentItem, order: number): RecipeEquipmentFormItem | null => {
      const trimmed = item.text.trim();

      if (!trimmed) return null;

      return {
        id: item.recipeEquipmentId,
        version: item.version,
        name: trimmed,
        order,
      };
    },
    []
  );

  const flushParse = useCallback(
    (updatedItems: InternalEquipmentItem[]) => {
      const parsed = updatedItems
        .map((item, idx) => parseLine(item, idx))
        .filter((eq): eq is RecipeEquipmentFormItem => eq !== null);

      onChange(parsed);
    },
    [parseLine, onChange]
  );

  const debouncedParse = useCallback(
    (updatedItems: InternalEquipmentItem[]) => {
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
      if (!items[index]?.text.trim() && index < items.length - 1) {
        const updated = items.filter((_, i) => i !== index);

        if (updated.length === 0) updated.push(createItem(""));
        setItems(updated);
        flushParse(updated);
      } else {
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
    (newOrder: InternalEquipmentItem[]) => {
      const normalized = normalizeEquipmentItems(newOrder);

      setItems(normalized);
      debouncedParse(normalized);
    },
    [debouncedParse]
  );

  const equipmentNames = items.map((item) => {
    const name = item.text.trim();

    return !name || name.startsWith("#") || namesNoFood(name) ? "" : name;
  });
  const resolvedEquipment = useEquipmentByName(equipmentNames);

  const getEquipmentNumber = (index: number): number | null => {
    const isHeading = (item: InternalEquipmentItem) => item.text.trim().startsWith("#");
    const item = items[index];

    if (!item || isHeading(item)) return null;

    return items.slice(0, index + 1).filter((it) => !isHeading(it)).length;
  };

  return (
    <EquipmentIconsProvider ids={[...resolvedEquipment.values()]}>
      <Reorder.Group
        ref={dragConstraintsRef}
        axis="y"
        className="flex flex-col gap-2"
        values={items}
        onReorder={handleReorder}
      >
        {items.map((item, index) => (
          <EquipmentInputRow
            key={item.id}
            dragConstraintsRef={dragConstraintsRef}
            equipmentId={resolvedEquipment.get(equipmentNames[index] ?? "") ?? null}
            equipmentNumber={getEquipmentNumber(index)}
            equipmentPlaceholder={t("placeholder")}
            index={index}
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
    </EquipmentIconsProvider>
  );
}

function normalizeEquipmentItems(next: InternalEquipmentItem[]): InternalEquipmentItem[] {
  const withoutTrailingEmpty = next.filter((it) => it.text.trim().length > 0);
  const normalized = [...withoutTrailingEmpty, createItem("")];

  return normalized.length ? normalized : [createItem("")];
}

interface EquipmentInputRowProps {
  item: InternalEquipmentItem;
  index: number;
  equipmentId: string | null;
  equipmentNumber: number | null;
  isLast: boolean;
  showRemove: boolean;
  dragConstraintsRef: React.RefObject<HTMLUListElement | null>;
  equipmentPlaceholder: string;
  onValueChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onBlur: () => void;
  onRemove: () => void;
}

function EquipmentInputRow({
  item,
  index,
  equipmentId,
  equipmentNumber,
  isLast,
  showRemove,
  dragConstraintsRef,
  equipmentPlaceholder,
  onValueChange,
  onKeyDown,
  onBlur,
  onRemove,
}: EquipmentInputRowProps) {
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

      <div className="text-muted flex h-10 w-6 flex-shrink-0 items-center justify-center font-medium">
        {equipmentNumber !== null ? `${equipmentNumber}.` : ""}
      </div>

      {equipmentNumber !== null ? (
        <EquipmentIcon className="mt-1" equipmentId={equipmentId} />
      ) : null}

      <div className="flex-1">
        <SmartTextInput
          minRows={1}
          placeholder={index === 0 ? equipmentPlaceholder : ""}
          value={item.text}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
          onValueChange={onValueChange}
        />
      </div>

      <div className="mt-1 h-8 w-8 min-w-8 flex-shrink-0">
        {showRemove && (
          <Button
            isIconOnly
            className="h-full w-full"
            size="sm"
            variant="tertiary"
            onPress={onRemove}
          >
            <XMarkIcon className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Reorder.Item>
  );
}
