"use client";

import { ListBox, Select } from "@heroui/react";

import type { PermissionLevel } from "@norish/config/zod/server-config";

const LEVELS: readonly PermissionLevel[] = ["everyone", "household", "owner"];

/** One permission level's words, as the card that shows it phrases them. */
export type PermissionLevelLabels = Record<PermissionLevel, { label: string; description: string }>;

interface PermissionLevelSelectProps {
  ariaLabel: string;
  value: PermissionLevel | null;
  labels: PermissionLevelLabels;
  isDisabled: boolean;
  onChange: (level: PermissionLevel) => void;
}

/** The everyone / household / owner select every permission policy row uses. */
export function PermissionLevelSelect({
  ariaLabel,
  value,
  labels,
  isDisabled,
  onChange,
}: PermissionLevelSelectProps) {
  return (
    <Select
      aria-label={ariaLabel}
      className="w-full sm:w-48"
      isDisabled={isDisabled}
      placeholder={ariaLabel}
      selectedKey={value}
      size="sm"
      variant="secondary"
      onSelectionChange={(key) => {
        if (typeof key === "string") onChange(key as PermissionLevel);
      }}
    >
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover placement="bottom end">
        <ListBox>
          {LEVELS.map((level) => (
            <ListBox.Item key={level} id={level} textValue={labels[level].label}>
              <div className="flex flex-col">
                <span>{labels[level].label}</span>
                <span className="text-muted text-xs">{labels[level].description}</span>
              </div>
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
