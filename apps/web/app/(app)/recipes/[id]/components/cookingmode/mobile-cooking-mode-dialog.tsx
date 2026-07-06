"use client";

import type { CookingModeDialogProps } from "./types";
import { CookingModeTabs } from "./cooking-mode-tabs";

export function MobileCookingModeDialog(props: CookingModeDialogProps) {
  return <CookingModeTabs {...props} showIngredientsTitle={false} />;
}
