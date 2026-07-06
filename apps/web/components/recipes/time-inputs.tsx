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
    // Allow: backspace, delete, tab, escape, enter
    if ([8, 9, 27, 13, 46].includes(e.keyCode)) {
      return;
    }
    // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
    if (
      (e.keyCode === 65 || e.keyCode === 67 || e.keyCode === 86 || e.keyCode === 88) &&
      (e.ctrlKey || e.metaKey)
    ) {
      return;
    }
    // Allow: home, end, left, right, up, down
    if (e.keyCode >= 35 && e.keyCode <= 40) {
      return;
    }
    // Ensure that it is a number and stop the keypress if not
    if ((e.shiftKey || e.keyCode < 48 || e.keyCode > 57) && (e.keyCode < 96 || e.keyCode > 105)) {
      e.preventDefault();
    }
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
