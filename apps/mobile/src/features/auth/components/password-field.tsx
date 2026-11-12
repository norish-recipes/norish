import type { InlineErrorState } from "@/features/auth/components/inline-error";
import type { ComponentRef, ReactNode, Ref } from "react";
import type { TextInput } from "react-native";
import React, { useState } from "react";
import { Pressable } from "react-native";
import { AuthField } from "@/features/auth/components/auth-field";
import Feather from "@expo/vector-icons/Feather";
import { InputGroup, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

interface PasswordFieldProps {
  label: string;
  labelAccessory?: ReactNode;
  placeholder: string;
  error: InlineErrorState;
  testID: string;
  /** `newPassword` asks AutoFill to suggest one; `password` fills a saved one. */
  textContentType: "password" | "newPassword";
  /** `next` keeps the keyboard up for the field after it. */
  returnKeyType: "next" | "go";
  /** Draws the show/hide toggle in the suffix. */
  revealable?: boolean;
  value: string;
  onChangeText: (text: string) => void;
  onSubmitEditing: () => void;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/** A signed-out form's secure password field, optionally with a show/hide toggle. */
export function PasswordField({
  label,
  labelAccessory,
  placeholder,
  error,
  testID,
  textContentType,
  returnKeyType,
  revealable = false,
  value,
  onChangeText,
  onSubmitEditing,
  ref,
}: PasswordFieldProps) {
  const intl = useIntl();
  const [mutedColor] = useThemeColor(["muted"] as const);
  const [isShown, setIsShown] = useState(false);

  return (
    <AuthField error={error} label={label} labelAccessory={labelAccessory}>
      <InputGroup.Input
        ref={ref}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        returnKeyType={returnKeyType}
        secureTextEntry={!isShown}
        submitBehavior={returnKeyType === "next" ? "submit" : undefined}
        testID={testID}
        textContentType={textContentType}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmitEditing}
      />
      {revealable ? (
        // heroui-native's own password toggle is a Pressable in the suffix.
        <InputGroup.Suffix>
          <Pressable
            accessibilityLabel={intl.formatMessage({
              id: isShown ? "auth.emailPassword.hidePassword" : "auth.emailPassword.showPassword",
            })}
            accessibilityRole="button"
            className="size-10 items-center justify-center"
            hitSlop={4}
            onPress={() => setIsShown((shown) => !shown)}
          >
            <Feather color={mutedColor} name={isShown ? "eye-off" : "eye"} size={20} />
          </Pressable>
        </InputGroup.Suffix>
      ) : null}
    </AuthField>
  );
}
