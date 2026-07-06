"use client";

import type { CookingModeDialogProps } from "./types";
import { CookingModeTabs } from "./cooking-mode-tabs";

export function DesktopCookingModeDialog(props: CookingModeDialogProps) {
  return (
    <div className="bg-overlay shadow-overlay flex h-[min(92dvh,900px)] w-[min(1180px,calc(100vw-4rem))] flex-col overflow-hidden rounded-3xl">
      <CookingModeTabs {...props} showIngredientsTitle />
    </div>
  );
}
