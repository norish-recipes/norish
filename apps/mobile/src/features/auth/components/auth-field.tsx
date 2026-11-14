import type { InlineErrorState } from "@/features/auth/components/inline-error";
import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { View } from "react-native";
import { ErrorShake } from "@/features/auth/components/inline-error";
import { InputGroup, Label, TextField } from "heroui-native";

interface AuthFieldProps extends Omit<ComponentProps<typeof InputGroup.Input>, "className"> {
  label: string;
  /** Beside the label, such as a help popover. */
  labelAccessory?: ReactNode;
  /** The failed attempt that turns the field's border danger and shakes its input box. */
  error: InlineErrorState;
  /** A 20pt icon before the input. */
  icon?: ReactNode;
  /** After the input, such as the password toggle. */
  suffix?: ReactNode;
  /** Sign-in and sign-up's 50pt field instead of Server address's 52pt. */
  compact?: boolean;
}

/** A signed-out form's field: its label left-aligned above it, never turning danger itself. */
export function AuthField({
  label,
  labelAccessory,
  error,
  icon,
  suffix,
  compact = false,
  ...inputProps
}: AuthFieldProps) {
  const isInvalid = error !== null;

  return (
    <TextField className={compact ? "gap-1.5" : "gap-2"} isInvalid={isInvalid}>
      {/* A 20pt label row, so the 28pt help button overhangs it rather than pushing the field down. */}
      <View
        className={`flex-row items-center gap-1 pl-1 ${compact && labelAccessory ? "h-5" : ""}`}
      >
        <Label isInvalid={false}>
          <Label.Text className="text-[14px] leading-[17px]">{label}</Label.Text>
        </Label>
        {labelAccessory}
      </View>
      <ErrorShake error={error}>
        <InputGroup>
          {icon ? (
            <InputGroup.Prefix isDecorative className="pr-2.5 pl-4">
              {icon}
            </InputGroup.Prefix>
          ) : null}
          {/* A 1pt border replaces heroui-native's iOS shadow and outline, so focus and error recolour it. */}
          <InputGroup.Input
            className={`${compact ? "h-[50px]" : "h-[52px]"} ios:shadow-none ios:outline-transparent ios:focus:outline-transparent rounded-[14px] border px-4 text-[17px] ${isInvalid ? "border-danger" : "border-border focus:border-accent"}`}
            {...inputProps}
          />
          {suffix ? <InputGroup.Suffix className="pr-1.5 pl-2">{suffix}</InputGroup.Suffix> : null}
        </InputGroup>
      </ErrorShake>
    </TextField>
  );
}
