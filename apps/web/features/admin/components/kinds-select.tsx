"use client";

import { Label, ListBox, Select } from "@heroui/react";

type KindOption<K extends string> = { id: K; label: string; description: string };

/** A multi-select of kinds, each with a line saying what it does; the trigger names the chosen. */
export function KindsSelect<K extends string>({
  label,
  placeholder,
  options,
  value,
  isDisabled,
  testId,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: KindOption<K>[];
  value: K[];
  isDisabled: boolean;
  testId?: string;
  onChange: (chosen: K[]) => void;
}) {
  const chosen = options.filter((option) => value.includes(option.id));

  return (
    <Select
      aria-label={label}
      className="w-full"
      data-testid={testId}
      isDisabled={isDisabled}
      placeholder={placeholder}
      selectionMode="multiple"
      value={chosen.map((option) => option.id)}
      variant="secondary"
      onChange={(keys) => onChange(options.filter((o) => keys.includes(o.id)).map((o) => o.id))}
    >
      <Label className="sr-only">{label}</Label>
      <Select.Trigger>
        {/* `min-w-0` lets the joined names shrink, so the field clips them rather than the panel. */}
        <Select.Value className="min-w-0">
          {({ defaultChildren, isPlaceholder }) =>
            isPlaceholder ? (
              defaultChildren
            ) : (
              <span className="block truncate">
                {chosen.map((option) => option.label).join(", ")}
              </span>
            )
          }
        </Select.Value>
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox selectionMode="multiple">
          {options.map((option) => (
            <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
              <div className="flex flex-col">
                <span>{option.label}</span>
                <span className="text-muted text-xs">{option.description}</span>
              </div>
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
