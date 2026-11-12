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
    // The boards dim a running attempt to 0.7, over heroui-native's 0.5 disabled opacity.
    <Button
      className="h-[52px] gap-2 rounded-full"
      isDisabled={isDisabled}
      style={isBusy ? { opacity: 0.7 } : undefined}
      testID={testID}
      onPress={onPress}
    >
      {isBusy ? (
        <Spinner className="size-5" color={accentForegroundColor}>
          <Spinner.Indicator iconProps={{ width: 20, height: 20 }} />
        </Spinner>
      ) : (
        icon(accentForegroundColor)
      )}
      <Button.Label className="text-[17px] font-semibold">{label}</Button.Label>
    </Button>
  );
}
