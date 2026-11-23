import React from "react";
import { NativeMenu } from "@/components/native-menu";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColor } from "heroui-native";

import { useConnectivity } from "@norish/shared-react/offline/react";

import { SettingsRow } from "./settings-row";

/** A row showing the chosen option under its title that opens iOS's menu of the others, the
 * chosen one ticked. Off while Offline or `saving`: a choice is a write, and none is Queued. */
export function ChoiceRow<T extends string>({
  title,
  value,
  options,
  optionLabel,
  saving = false,
  testID,
  onChange,
}: {
  title: string;
  value: T;
  options: readonly T[];
  optionLabel: (option: T) => string;
  saving?: boolean;
  testID: string;
  onChange: (choice: T) => void;
}) {
  const { isOffline } = useConnectivity();
  const [muted] = useThemeColor(["muted"] as const);
  const shown = optionLabel(value);
  const row = (
    <SettingsRow
      write
      subtitle={shown}
      testID={`${testID}-row`}
      title={title}
      trailing={<Ionicons color={muted} name="chevron-expand" size={16} />}
    />
  );

  if (isOffline || saving) return row;

  return (
    <NativeMenu
      items={options.map((option) => ({
        key: option,
        label: optionLabel(option),
        systemImage: option === value ? "checkmark" : undefined,
        onPress: () => option !== value && onChange(option),
      }))}
      label={`${title}, ${shown}`}
      testID={testID}
    >
      {row}
    </NativeMenu>
  );
}
