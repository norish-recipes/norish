import React from "react";
import { Button } from "heroui-native";

/**
 * Pre-sized sheet footer button. Wraps HeroUI Button with size="lg" and
 * flex-1 so all panel action buttons share the same height and proportions.
 * Pass className to override flex or add extra styles.
 */
export function PanelButton({
  className,
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button size="md" className={["flex-1", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </Button>
  );
}
