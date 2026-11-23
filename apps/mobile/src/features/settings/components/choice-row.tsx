import React from "react";
import { ChoiceMenu } from "@/components/choice-menu";

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
  const row = (
    <SettingsRow
      write
      accessory="expand"
      subtitle={optionLabel(value)}
      testID={`${testID}-row`}
      title={title}
    />
  );

  if (isOffline || saving) return row;

  return (
    <ChoiceMenu
      label={title}
      optionLabel={optionLabel}
      options={options}
      testID={testID}
      value={value}
      onChange={onChange}
    >
      {row}
    </ChoiceMenu>
  );
}
