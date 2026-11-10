"use client";

import type { CookingModeDialogProps } from "./types";
import { CookingModeShell } from "./cooking-mode-shell";

export function DesktopCookingModeDialog(props: CookingModeDialogProps) {
  // The card's ground is the tinted card surface, not the overlay token: the
  // dish tint (ADR-0023) rebuilds --surface inside the backdrop's scope but
  // never --overlay, so an overlay ground would be the one untinted plane in
  // a cooking mode that is otherwise the recipe's own hue — and the card wash
  // is also what lifts the card off the full-strength ground behind it.
  return (
    <div className="bg-surface shadow-overlay flex h-[min(92dvh,900px)] w-[min(1180px,calc(100vw-4rem))] flex-col overflow-hidden rounded-3xl">
      <CookingModeShell {...props} showIngredientsTitle />
    </div>
  );
}
