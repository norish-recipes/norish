import type { ReactNode } from "react";
import React from "react";
import { Button, Spinner, useThemeColor } from "heroui-native";

interface AuthSubmitButtonProps {
  label: string;
  /** Draws the button's icon in the colour it is given. */
  icon: (color: string) => ReactNode;
  /** Its attempt is running, so a spinner stands in for the icon. */
  isBusy: boolean;
  isDisabled: boolean;
  testID: string;
  onPress: () => void;
}

/** A signed-out form's solid primary action. */
export function AuthSubmitButton({
  label,
  icon,
  isBusy,
  isDisabled,
  testID,
  onPress,
}: AuthSubmitButtonProps) {
  const [accentForegroundColor] = useThemeColor(["accent-foreground"] as const);

  return (
    <Button
      className="rounded-full"
      isDisabled={isDisabled}
      size="lg"
      testID={testID}
      onPress={onPress}
    >
      {isBusy ? <Spinner color={accentForegroundColor} size="sm" /> : icon(accentForegroundColor)}
      <Button.Label>{label}</Button.Label>
    </Button>
  );
}
