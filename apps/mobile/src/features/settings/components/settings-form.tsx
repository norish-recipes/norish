import type { ComponentProps } from "react";
import React from "react";
import { Text, View } from "react-native";
import { LabelWithHint } from "@/components/hint-button";
import { SheetInput } from "@/components/sheet-input";
import { Button, TextField } from "heroui-native";

import { useConnectivity } from "@norish/shared-react/offline/react";

/** A Settings form's field: its label with any description behind a hint (`<testID>-hint`), the
 * capsule, locked while Offline, and the error under it. */
export function SettingsField({
  label,
  hint,
  error,
  testID,
  ...input
}: ComponentProps<typeof SheetInput> & {
  label: string;
  hint?: string;
  error?: string | null;
  testID: string;
}) {
  const { isOffline } = useConnectivity();

  return (
    <View>
      <LabelWithHint hint={hint} label={label} testID={hint ? `${testID}-hint` : undefined} />
      <TextField>
        <SheetInput accessibilityLabel={label} editable={!isOffline} testID={testID} {...input} />
      </TextField>
      {error ? <Text className="text-danger px-2 pt-1.5 text-[13px]">{error}</Text> : null}
    </View>
  );
}

/** A Settings form's full-width pill that sends it: Save, Create or Join. */
export function SubmitButton({
  label,
  className = "mt-4",
  ...button
}: {
  label: string;
  className?: string;
  isDisabled: boolean;
  testID: string;
  onPress: () => void;
}) {
  return (
    <Button className={`${className} h-[50px] rounded-full`} {...button}>
      <Button.Label className="text-base font-semibold">{label}</Button.Label>
    </Button>
  );
}
