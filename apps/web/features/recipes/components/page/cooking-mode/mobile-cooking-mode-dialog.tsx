"use client";

import type { CookingModeDialogProps } from "./types";
import { CookingModeShell } from "./cooking-mode-shell";

export function MobileCookingModeDialog(props: CookingModeDialogProps) {
  return <CookingModeShell {...props} showIngredientsTitle={false} />;
}
