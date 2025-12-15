"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@heroui/react";
import { XMarkIcon } from "@heroicons/react/16/solid";

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

export default function IngredientInput({
  ingredients,
  onChange,
  systemUsed = "metric",
  onSystemDetected: _onSystemDetected,
}: IngredientInputProps) {
  const { units } = useUnitsQuery();
  const [inputs, setInputs] = useState<string[]>([""]);
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  // Initialize from ingredients prop
  useEffect(() => {
    if (ingredients.length > 0 && inputs.length === 1 && inputs[0] === "") {
      const formatted = ingredients.map((ing) => {
        const parts: string[] = [];

        if (ing.amount !== null) parts.push(String(ing.amount));
        if (ing.unit) parts.push(ing.unit);
        if (ing.ingredientName) parts.push(ing.ingredientName);

        return parts.join(" ");
      });

      setInputs([...formatted, ""]);
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
    (updatedInputs: string[]) => {
      const doUpdate = debounce((inputs: string[]) => {
        const parsed = inputs
          .map((text, idx) => parseIngredient(text, idx))
          .filter((ing): ing is ParsedIngredient => ing !== null);

        onChange(parsed);
      }, 300);

      doUpdate(updatedInputs);
    },
    [parseIngredient, onChange]
  );

  const handleInputChange = useCallback(
    (index: number, value: string) => {
      const updated = [...inputs];

      updated[index] = value;

      // Auto-add empty line at the end
      if (index === inputs.length - 1 && value.trim()) {
        updated.push("");
      }

      setInputs(updated);
      debouncedParse(updated);
    },
    [inputs, debouncedParse]
  );

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        // Move to next input or create new one
        if (index < inputs.length - 1) {
          textareaRefs.current[index + 1]?.focus();
        } else {
          const updated = [...inputs, ""];

          setInputs(updated);
          setTimeout(() => {
            textareaRefs.current[inputs.length]?.focus();
          }, 0);
        }
      } else if (e.key === "Backspace" && !inputs[index] && index > 0) {
        e.preventDefault();
        const updated = inputs.filter((_, i) => i !== index);

        setInputs(updated);
        debouncedParse(updated);
        setTimeout(() => {
          textareaRefs.current[index - 1]?.focus();
        }, 0);
      }
    },
    [inputs, debouncedParse]
  );

  const handleBlur = useCallback(
    (index: number) => {
      // Auto-remove empty rows on blur (except the last one)
      if (!inputs[index].trim() && index < inputs.length - 1) {
        const updated = inputs.filter((_, i) => i !== index);

        if (updated.length === 0) updated.push("");
        setInputs(updated);
        debouncedParse(updated);
      }
    },
    [inputs, debouncedParse]
  );

  const handleRemove = useCallback(
    (index: number) => {
      const updated = inputs.filter((_, i) => i !== index);

      if (updated.length === 0) updated.push("");
      setInputs(updated);
      debouncedParse(updated);
    },
    [inputs, debouncedParse]
  );

  return (
    <div className="flex flex-col gap-2">
      {(() => {
        let ingredientNumber = 0;
        return inputs.map((value, index) => {
          const isHeading = value.trim().startsWith("#");
          if (!isHeading) ingredientNumber++;

          return (
            <div key={index} className="flex items-start gap-2">
              <div className="text-default-500 flex h-10 w-8 flex-shrink-0 items-center justify-center font-medium">
                {isHeading ? "" : `${ingredientNumber}.`}
              </div>
              <div className="flex-1">
                <SmartTextInput
                  minRows={1}
                  placeholder={index === 0 ? "e.g., 2 cups flour" : ""}
                  value={value}
                  onBlur={() => handleBlur(index)}
                  onKeyDown={(e) =>
                    handleKeyDown(index, e as unknown as React.KeyboardEvent<HTMLInputElement>)
                  }
                  onValueChange={(v) => handleInputChange(index, v)}
                />
              </div>
              <div className="mt-1 h-8 w-8 min-w-8 flex-shrink-0">
                {inputs.length > 1 && value && (
                  <Button
                    isIconOnly
                    className="h-full w-full"
                    size="sm"
                    variant="light"
                    onPress={() => handleRemove(index)}
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        });
      })()}
    </div>
  );
}
