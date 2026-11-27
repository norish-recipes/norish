import type { ComponentProps } from "react";
import React from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@/components/icon";
import { Pill } from "@/components/pill";
import { SheetInput } from "@/components/sheet-input";
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
  keepsFocus = false,
  onChange,
  onSubmit,
}: {
  value: string;
  placeholderId: string;
  testID: string;
  fieldRef?: ComponentProps<typeof Input>["ref"];
  /** Return submits with the keyboard left up, for the next one. */
  keepsFocus?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const intl = useIntl();

  return (
    <TextField>
      <SheetInput
        ref={fieldRef}
        accessibilityLabel={intl.formatMessage({ id: "groceries.mobile.itemLabel" })}
        placeholder={intl.formatMessage({ id: placeholderId })}
        returnKeyType="done"
        submitBehavior={keepsFocus ? "submit" : "blurAndSubmit"}
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
  const [muted] = useThemeColor(["muted"] as const);

  if (!detected && !confirmed) return null;

  return (
    <View className="flex-row flex-wrap items-center gap-2 px-1" testID="repeat-pills">
      {detected ? (
        <Pressable
          accessibilityRole="button"
          className="border-muted h-8 flex-row items-center gap-1.5 rounded-full border border-dashed px-3"
          testID="repeat-detected"
          onPress={onConfirmDetected}
        >
          <Ionicons color={muted} name="repeat" size={14} />
          <Text className="text-muted text-sm font-medium">{label(detected)}</Text>
        </Pressable>
      ) : null}
      {confirmed ? (
        <View className="flex-row items-center">
          <Pressable accessibilityRole="button" testID="repeat-confirmed" onPress={onEdit}>
            <Pill icon="repeat" size="tag">
              {label(confirmed)}
            </Pill>
          </Pressable>
          <Pressable
            accessibilityLabel={intl.formatMessage({ id: "groceries.mobile.removeRepeat" })}
            accessibilityRole="button"
            className="size-8 items-center justify-center"
            testID="repeat-remove"
            onPress={onRemove}
          >
            <Ionicons color={muted} name="close" size={14} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
