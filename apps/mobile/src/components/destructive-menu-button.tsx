import type { ComponentProps } from "react";
import React from "react";
import { Button } from "@expo/ui/swift-ui";

/** A SwiftUI menu button in the destructive role, red in the menu. */
export function DestructiveMenuButton(props: Omit<ComponentProps<typeof Button>, "role">) {
  // eslint-disable-next-line jsx-a11y-x/aria-role -- role is SwiftUI's ButtonRole, not an ARIA role
  return <Button {...props} role="destructive" />;
}
