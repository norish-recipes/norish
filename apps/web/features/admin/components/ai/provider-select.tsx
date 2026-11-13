"use client";

import { Label, ListBox, Select } from "@heroui/react";
import { useTranslations } from "next-intl";

/** "lm-studio" reads its label from `lmStudio`. */
const messageKey = (provider: string) =>
  provider.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());

/** A provider pick, each option labelled by its message under `messages`. */
export function ProviderSelect<P extends string>({
  label,
  messages,
  options,
  value,
  isDisabled,
  onChange,
}: {
  label: string;
  messages: string;
  options: readonly P[];
  value: P;
  isDisabled?: boolean;
  onChange: (provider: P) => void;
}) {
  const t = useTranslations();

  return (
    <Select
      isDisabled={isDisabled}
      placeholder={label}
      value={value}
      variant="secondary"
      onChange={(selected) => {
        const picked = options.find((option) => option === selected);

        if (picked) onChange(picked);
      }}
    >
      <Label>{label}</Label>
      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {options.map((option) => {
            const optionLabel = t(`${messages}.${messageKey(option)}` as Parameters<typeof t>[0]);

            return (
              <ListBox.Item key={option} id={option} textValue={optionLabel}>
                {optionLabel}
              </ListBox.Item>
            );
          })}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
