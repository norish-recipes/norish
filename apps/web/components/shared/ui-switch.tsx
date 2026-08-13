"use client";

import type { ComponentProps, ReactNode } from "react";
import { Switch } from "@heroui/react";

type UiSwitchProps = Omit<ComponentProps<typeof Switch>, "children" | "onChange"> & {
  children?: ReactNode;
  onValueChange?: (isSelected: boolean) => void;
};

export default function UiSwitch({ children, onValueChange, ...props }: UiSwitchProps) {
  // `Switch` is the field wrapper; `Switch.Content` is the clickable button, so
  // the control and the label both have to live inside it or neither toggles.
  return (
    <Switch {...props} onChange={onValueChange}>
      <Switch.Content>
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        {children}
      </Switch.Content>
    </Switch>
  );
}
