import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { SheetInput } from "@/components/sheet-input";
import { useAccentTextColor } from "@/hooks/use-accent-text-color";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Input, TextField, useThemeColor } from "heroui-native";
import { useIntl } from "react-intl";

import type { RecurrencePattern } from "@norish/shared/contracts/recurrence";

import { useRecurrenceLabel } from "../hooks/use-recurrence-label";

/** The grocery's text: an amount, a unit and a name, or "milk every week". */
export function NameField({
  value,
  placeholderId,
  testID,
  fieldRef,
  onChange,
  onSubmit,
}: {
  value: string;
  placeholderId: string;
  testID: string;
  fieldRef?: ComponentProps<typeof Input>["ref"];
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const intl = useIntl();

  return (
    <TextField>
      <SheetInput
        ref={fieldRef}
        accessibilityLabel={intl.formatMessage({ id: "groceries.mobile.itemLabel" })}
        className="h-[52px] text-[17px]"
        placeholder={intl.formatMessage({ id: placeholderId })}
        returnKeyType="done"
        testID={testID}
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
      />
    </TextField>
  );
}

/** The repeat under the field: the one the text states, a dashed pill a tap takes, and the one
 * it has, a filled pill that opens Repeat and has an ×. */
export function RepeatPills({
  detected,
  confirmed,
  onConfirmDetected,
  onEdit,
  onRemove,
}: {
  detected: RecurrencePattern | null;
  confirmed: RecurrencePattern | null;
  onConfirmDetected: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const intl = useIntl();
  const label = useRecurrenceLabel();
  const accent = useAccentTextColor();
  const [muted] = useThemeColor(["muted"] as const);

  if (!detected && !confirmed) return null;

  return (
    <View className="flex-row flex-wrap items-center gap-2 px-1" testID="repeat-pills">
      {detected ? (
        <Pressable
          accessibilityRole="button"
          className="border-border h-8 flex-row items-center gap-1.5 rounded-full border border-dashed px-3"
          testID="repeat-detected"
          onPress={onConfirmDetected}
        >
          <Ionicons color={muted} name="repeat" size={14} />
          <Text className="text-muted text-sm font-medium">{label(detected)}</Text>
        </Pressable>
      ) : null}
      {confirmed ? (
        <View className="bg-accent/10 h-8 flex-row items-center rounded-full pl-3">
          <Pressable accessibilityRole="button" testID="repeat-confirmed" onPress={onEdit}>
            <Text className="text-accent-text text-sm font-medium">{label(confirmed)}</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={intl.formatMessage({ id: "groceries.mobile.removeRepeat" })}
            accessibilityRole="button"
            className="size-8 items-center justify-center"
            testID="repeat-remove"
            onPress={onRemove}
          >
            <Ionicons color={accent} name="close" size={14} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

/** The sheet's rows on one rounded card. */
export function FormCard({ children }: { children: ReactNode }) {
  return <View className="bg-surface overflow-hidden rounded-[22px]">{children}</View>;
}

/** A row of the form: its label, its value (with a Store's dot), and a chevron where it opens a choice. */
export function FormRow({
  label,
  value,
  dotColor,
  first = false,
  testID,
  onPress,
}: {
  label: string;
  value: string;
  dotColor?: string;
  first?: boolean;
  testID: string;
  onPress: () => void;
}) {
  const [muted] = useThemeColor(["muted"] as const);

  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-[52px] flex-row items-center gap-2 px-4 ${first ? "" : "border-separator border-t"}`}
      testID={testID}
      onPress={onPress}
    >
      <Text className="text-foreground flex-1 text-base">{label}</Text>
      {dotColor ? (
        <View className="size-2 rounded-full" style={{ backgroundColor: dotColor }} />
      ) : null}
      <Text className="text-muted max-w-[55%] text-base" numberOfLines={1}>
        {value}
      </Text>
      <Ionicons color={muted} name="chevron-forward" size={16} />
    </Pressable>
  );
}

/** A capsule of choices, one on at a time. */
export function Segmented<T extends string>({
  options,
  value,
  small = false,
  testID,
  onChange,
}: {
  options: readonly { id: T; label: string }[];
  value: T | null;
  small?: boolean;
  testID: string;
  onChange: (id: T) => void;
}) {
  return (
    <View className="bg-default h-11 flex-row gap-0.5 rounded-full p-1" testID={testID}>
      {options.map((option) => (
        <Pressable
          key={option.id}
          accessibilityRole="button"
          accessibilityState={{ selected: value === option.id }}
          className={`flex-1 items-center justify-center rounded-full ${value === option.id ? "bg-surface" : ""}`}
          testID={`${testID}-${option.id}`}
          onPress={() => onChange(option.id)}
        >
          <Text
            className={`${small ? "text-[13px]" : "text-[15px]"} font-medium ${value === option.id ? "text-foreground" : "text-muted"}`}
            numberOfLines={1}
          >
            {option.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** A small caps label over a group of controls. */
export function FieldLabel({ children }: { children: string }) {
  return (
    <Text className="text-muted px-2 text-xs font-semibold tracking-[0.6px] uppercase">
      {children}
    </Text>
  );
}
