"use client";

import type { ReactNode } from "react";
import { Button, toast } from "@heroui/react";

type ActionToastOptions = {
  description?: ReactNode;
  variant?: "default" | "accent" | "success" | "warning" | "danger";
  timeout?: number;
  action: { label: string; onPress: () => void };
};

/**
 * A toast with one action (Undo, Import, Open) that stays on the title's line
 * at every width: HeroUI's own action drops under the title on a phone. The
 * toast closes when the action is pressed. Returns the toast's key.
 */
export function showActionToast(title: ReactNode, { action, ...options }: ActionToastOptions) {
  const key: string = toast(
    <span className="flex w-full items-center justify-between gap-3" data-action-toast>
      <span className="min-w-0">{title}</span>
      <Button
        className="shrink-0"
        size="sm"
        variant="secondary"
        onPress={() => {
          toast.close(key);
          action.onPress();
        }}
      >
        {action.label}
      </Button>
    </span>,
    options
  );

  return key;
}
