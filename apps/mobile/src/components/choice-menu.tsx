import type { ReactNode } from "react";
import React from "react";
import { NativeMenu } from "@/components/native-menu";

/** iOS's menu of `options` over `children`, the chosen one ticked and read out as the value. */
export function ChoiceMenu<T extends string>({
  value,
  options,
  optionLabel,
  label,
  testID,
  onChange,
  children,
}: {
  value: T;
  options: readonly T[];
  optionLabel: (option: T) => string;
  label: string;
  testID: string;
  onChange: (choice: T) => void;
  children: ReactNode;
}) {
  return (
    <NativeMenu
      items={options.map((option) => ({
        key: option,
        label: optionLabel(option),
        systemImage: option === value ? "checkmark" : undefined,
        onPress: () => {
          if (option !== value) onChange(option);
        },
      }))}
      label={label}
      testID={testID}
      value={optionLabel(value)}
    >
      {children}
    </NativeMenu>
  );
}
