import type { InlineErrorState } from "@/features/auth/components/inline-error";
import type { ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { ErrorShake } from "@/features/auth/components/inline-error";
import { InputGroup, Label, TextField } from "heroui-native";

interface AuthFieldProps {
  label: string;
  /** Beside the label, such as a help popover. */
  labelAccessory?: ReactNode;
  /** The failed attempt that turns the field's border danger and shakes its input box. */
  error: InlineErrorState;
  /** The `InputGroup`'s parts: its input and any prefix or suffix. */
  children: ReactNode;
}

/** A signed-out form's field: its label left-aligned above it, never turning danger itself. */
export function AuthField({ label, labelAccessory, error, children }: AuthFieldProps) {
  return (
    <TextField isInvalid={error !== null}>
      <View className="flex-row items-center gap-1 pl-1">
        <Label isInvalid={false}>{label}</Label>
        {labelAccessory}
      </View>
      <ErrorShake error={error}>
        <InputGroup>{children}</InputGroup>
      </ErrorShake>
    </TextField>
  );
}
