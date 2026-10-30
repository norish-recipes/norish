"use client";

import React, { useCallback } from "react";
import { Input, Label, TextField } from "@heroui/react";
import { useTranslations } from "next-intl";

export interface TimeInputsProps {
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  totalMinutes?: number | null;
  onChange: (field: "prepMinutes" | "cookMinutes" | "totalMinutes", value: number | null) => void;
}

// Editing and navigation keys the digit-only fields let through.
const PASSTHROUGH_KEYS = new Set([
  "Backspace",
  "Tab",
  "Escape",
  "Enter",
  "Delete",
  "Home",
  "End",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
]);
const CLIPBOARD_KEYS = new Set(["a", "c", "v", "x"]);
// The same shortcuts by physical key, for layouts whose letters are not Latin.
const CLIPBOARD_CODES = new Set(["KeyA", "KeyC", "KeyV", "KeyX"]);

export default function TimeInputs({
  prepMinutes,
  cookMinutes,
  totalMinutes,
  onChange,
}: TimeInputsProps) {
  const t = useTranslations("recipes.timeInputs");

  const handleChange = useCallback(
    (field: "prepMinutes" | "cookMinutes" | "totalMinutes", value: string) => {
      // Allow empty string
      if (value === "" || value === null || value === undefined) {
        onChange(field, null);

        return;
      }

      // Only allow digits
      if (!/^\d+$/.test(value)) {
        return; // Don't update if non-numeric
      }

      const parsed = parseInt(value, 10);

      if (!isNaN(parsed) && parsed >= 0) {
        onChange(field, parsed);
      }
    },
    [onChange]
  );

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (PASSTHROUGH_KEYS.has(e.key)) return;
    // Ctrl/Cmd + A, C, V, X
    if (
      (e.ctrlKey || e.metaKey) &&
      (CLIPBOARD_KEYS.has(e.key.toLowerCase()) || CLIPBOARD_CODES.has(e.code))
    )
      return;
    // Anything else must type a digit
    if (!/^\d$/.test(e.key)) e.preventDefault();
  }, []);

  return (
    <div className="grid grid-cols-3 gap-3">
      <TextField
        type="text"
        value={prepMinutes?.toString() ?? ""}
        onChange={(value) => handleChange("prepMinutes", value)}
      >
        <Label>{t("prep")}</Label>
        <Input
          className="border-border dark:border-border-tertiary w-full text-base"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="0"
          onKeyDown={handleKeyDown}
        />
      </TextField>
      <TextField
        type="text"
        value={cookMinutes?.toString() ?? ""}
        onChange={(value) => handleChange("cookMinutes", value)}
      >
        <Label>{t("cook")}</Label>
        <Input
          className="border-border dark:border-border-tertiary w-full text-base"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="0"
          onKeyDown={handleKeyDown}
        />
      </TextField>
      <TextField
        type="text"
        value={totalMinutes?.toString() ?? ""}
        onChange={(value) => handleChange("totalMinutes", value)}
      >
        <Label>{t("total")}</Label>
        <Input
          className="border-border dark:border-border-tertiary w-full text-base"
          inputMode="numeric"
          pattern="[0-9]*"
          placeholder="0"
          onKeyDown={handleKeyDown}
        />
      </TextField>
    </div>
  );
}
