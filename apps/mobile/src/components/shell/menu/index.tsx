import React from "react";
import { Host, Menu } from "@expo/ui/swift-ui";
import { buttonStyle, foregroundStyle, labelStyle } from "@expo/ui/swift-ui/modifiers";

export interface ShellMenuProps {
  /** Text label for the menu trigger button. */
  label: string;
  /** SF Symbol name displayed as the trigger icon. */
  systemImage?: string;
  /** Color applied to the trigger icon via foregroundStyle modifier. */
  color?: string;
  /** Menu items — use `@expo/ui/swift-ui` Button, Picker, Divider, etc. */
  children: React.ReactNode;
}

export function ShellMenu({ label, systemImage, color, children }: ShellMenuProps) {
  return (
    <Host matchContents style={{ justifyContent: "center", alignItems: "center" }}>
      <Menu
        label={label}
        systemImage={systemImage}
        modifiers={[
          ...(color ? [foregroundStyle(color)] : []),
          labelStyle("iconOnly"),
          buttonStyle("plain"),
        ]}
      >
        {children}
      </Menu>
    </Host>
  );
}
