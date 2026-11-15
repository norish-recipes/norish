import type { ComponentRef, Ref } from "react";
import React from "react";
import { Pressable, TextInput, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import { PANTRY_INGREDIENT_NAME_MAX_LENGTH } from "@norish/shared/contracts/zod";

/** The field that both narrows the kept foods and finds catalogue foods to add. */
export function FindField({
  fieldRef,
  value,
  canAdd,
  disabled,
  onChange,
  onAdd,
}: {
  fieldRef: Ref<ComponentRef<typeof TextInput>>;
  value: string;
  canAdd: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onAdd: () => void;
}) {
  const intl = useIntl();
  const [muted, accentFg] = useThemeColor(["muted", "accent-foreground"] as const);
  const label = intl.formatMessage({ id: "groceries.pantry.fieldLabel" });

  return (
    <View
      className="bg-surface h-12 flex-row items-center gap-2.5 rounded-full pr-1.5 pl-4"
      pointerEvents={disabled ? "none" : "auto"}
    >
      <Ionicons color={muted} name="search-outline" size={18} />
      <TextInput
        ref={fieldRef}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        className="text-foreground h-full flex-1 text-base"
        maxLength={PANTRY_INGREDIENT_NAME_MAX_LENGTH}
        placeholder={intl.formatMessage({ id: "groceries.pantry.fieldPlaceholder" })}
        placeholderTextColor={muted}
        returnKeyType="done"
        testID="pantry-field"
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onAdd}
      />
      <Pressable
        accessibilityLabel={intl.formatMessage({ id: "groceries.pantry.add" })}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canAdd }}
        className={`size-9 items-center justify-center rounded-full ${canAdd ? "bg-accent" : "bg-default"}`}
        disabled={!canAdd}
        testID="pantry-add"
        onPress={onAdd}
      >
        <Ionicons color={canAdd ? accentFg : muted} name="add" size={20} />
      </Pressable>
    </View>
  );
}
