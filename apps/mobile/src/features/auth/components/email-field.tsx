import type { InlineErrorState } from "@/features/auth/components/inline-error";
import type { ComponentRef, Ref } from "react";
import type { TextInput } from "react-native";
import React from "react";
import { AuthField } from "@/features/auth/components/auth-field";
import { InputGroup } from "heroui-native";

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
    <AuthField error={error} label={label}>
      <InputGroup.Input
        ref={ref}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        placeholder={placeholder}
        returnKeyType="next"
        submitBehavior="submit"
        testID={testID}
        textContentType="username"
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
      />
    </AuthField>
  );
}
