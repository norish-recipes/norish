import React, { useState } from "react";
import { TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { PANTRY_INGREDIENT_NAME_MAX_LENGTH } from "@norish/shared/contracts/zod";

/** The Pantry's field: it narrows the kept foods and adds nothing. */
export function FindField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const intl = useIntl();
  const [muted] = useThemeColor(["muted"] as const);
  const label = intl.formatMessage({ id: "groceries.pantry.findPlaceholder" });
  const [focused, setFocused] = useState(false);

  return (
    <View
      className={`bg-surface h-12 flex-row items-center gap-2.5 rounded-full border-2 px-3.5 ${focused ? "border-accent" : "border-transparent"}`}
      pointerEvents={disabled ? "none" : "auto"}
    >
      <Ionicons color={muted} name="search-outline" size={18} />
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        className="text-foreground h-full flex-1 text-base"
        maxLength={PANTRY_INGREDIENT_NAME_MAX_LENGTH}
        placeholder={label}
        placeholderTextColor={muted}
        returnKeyType="search"
        testID="pantry-field"
        value={value}
        onBlur={() => setFocused(false)}
        onChangeText={onChange}
        onFocus={() => setFocused(true)}
      />
    </View>
  );
}
