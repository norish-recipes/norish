import type { ComponentProps } from "react";
import React from "react";
import { Input } from "heroui-native";

/** A sheet's text field: a capsule in the muted fill, as the sheets' search fields are. */
export function SheetInput({ className, ...props }: ComponentProps<typeof Input>) {
  return (
    <Input
      {...props}
      className={`h-12 rounded-full px-4 text-base ${className ?? ""}`}
      variant="secondary"
    />
  );
}
