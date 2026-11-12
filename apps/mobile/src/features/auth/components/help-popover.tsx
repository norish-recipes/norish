import React, { useState } from "react";
import { Button, Host, Popover, Text } from "@expo/ui/swift-ui";
import {
  buttonStyle,
  fixedSize,
  font,
  foregroundStyle,
  frame,
  labelStyle,
  padding,
} from "@expo/ui/swift-ui/modifiers";
import { useThemeColor } from "heroui-native";

interface HelpPopoverProps {
  /** What the button says to VoiceOver, such as "Server address help". */
  label: string;
  /** The help itself. */
  text: string;
  /** `questionmark.circle` for help, `info.circle` for a rule. */
  icon?: "questionmark.circle" | "info.circle";
}

/** A small icon button beside a field's label that opens its help in a native popover. */
export function HelpPopover({ label, text, icon = "questionmark.circle" }: HelpPopoverProps) {
  const [isPresented, setIsPresented] = useState(false);
  const [mutedColor] = useThemeColor(["muted"] as const);

  return (
    <Host matchContents>
      <Popover arrowEdge="bottom" isPresented={isPresented} onIsPresentedChange={setIsPresented}>
        <Popover.Trigger>
          <Button
            label={label}
            modifiers={[
              labelStyle("iconOnly"),
              buttonStyle("plain"),
              foregroundStyle(mutedColor),
              font({ size: 16 }),
              frame({ width: 28, height: 28 }),
            ]}
            systemImage={icon}
            onPress={() => setIsPresented(true)}
          />
        </Popover.Trigger>
        <Popover.Content>
          <Text
            modifiers={[
              // SwiftUI resolves the PostScript name; expo-font's `Inter_400Regular` alias is UIKit-only.
              font({ family: "Inter-Regular", size: 14 }),
              fixedSize({ horizontal: false, vertical: true }),
              frame({ maxWidth: 260, alignment: "leading" }),
              padding({ horizontal: 14, vertical: 12 }),
            ]}
          >
            {text}
          </Text>
        </Popover.Content>
      </Popover>
    </Host>
  );
}
