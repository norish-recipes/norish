import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { InputGroup, Label, TextField } from "heroui-native";

interface AuthFieldProps {
  label: string;
  /** Beside the label, such as a help popover. */
  labelAccessory?: ReactNode;
  isInvalid: boolean;
  /** The `InputGroup`'s parts: its input and any prefix or suffix. */
  children: ReactNode;
}

/** A signed-out form's field: its label left-aligned above it, never turning danger itself. */
export function AuthField({ label, labelAccessory, isInvalid, children }: AuthFieldProps) {
  return (
    <TextField isInvalid={isInvalid}>
      <View className="flex-row items-center gap-1 pl-1">
        <Label isInvalid={false}>{label}</Label>
        {labelAccessory}
      </View>
      <InputGroup>{children}</InputGroup>
    </TextField>
  );
}
