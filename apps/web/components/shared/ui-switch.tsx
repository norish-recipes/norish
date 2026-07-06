"use client";

import type { ComponentProps, ReactNode } from "react";
import { Switch } from "@heroui/react";

type UiSwitchProps = Omit<ComponentProps<typeof Switch>, "children" | "onChange"> & {
  children?: ReactNode;
  onValueChange?: (isSelected: boolean) => void;
};

export default function UiSwitch({ children, onValueChange, ...props }: UiSwitchProps) {
  return (
    <Switch {...props} onChange={onValueChange}>
      <Switch.Control>
        <Switch.Thumb />
      </Switch.Control>
      {children ? <Switch.Content>{children}</Switch.Content> : null}
    </Switch>
  );
}
