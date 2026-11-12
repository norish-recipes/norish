import type { InlineErrorState } from "@/features/auth/components/inline-error";
import type { ComponentRef, Ref } from "react";
import type { TextInput } from "react-native";
import React from "react";
import { AuthField } from "@/features/auth/components/auth-field";

interface EmailFieldProps {
  label: string;
  placeholder: string;
  error: InlineErrorState;
  testID: string;
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing: () => void;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/** A signed-out form's email field, the account name AutoFill saves with the password. */
export function EmailField({
  label,
  placeholder,
  error,
  testID,
  value,
  onChangeText,
  onSubmitEditing,
  ref,
}: EmailFieldProps) {
  return (
    <AuthField
      ref={ref}
      compact
      autoCapitalize="none"
      autoCorrect={false}
      error={error}
      keyboardType="email-address"
      label={label}
      placeholder={placeholder}
      returnKeyType="next"
      submitBehavior="submit"
      testID={testID}
      textContentType="username"
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmitEditing}
    />
  );
}
