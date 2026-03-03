import { Host, Menu } from '@expo/ui/swift-ui';
import React from 'react';

export interface ShellMenuProps {
  /**
   * The trigger element shown in the navigation bar (or wherever the menu
   * is placed). Typically a Pressable wrapping an icon.
   */
  label: React.ReactNode;
  /** Menu items — use `@expo/ui/swift-ui` Button, Picker, Divider, etc. */
  children: React.ReactNode;
}

export function ShellMenu({ label, children }: ShellMenuProps) {
  return (
    <Host matchContents style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Menu label={label}>{children}</Menu>
    </Host>
  );
}
