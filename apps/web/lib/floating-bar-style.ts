import type { FloatingBarStyle } from "@norish/shared/contracts/zod/device-preferences";

/** The attribute on <html> that styles/globals.css keys the `match` floating bar tokens on. */
export const FLOATING_BAR_ATTRIBUTE = "data-floating-bar";

/** Sets or clears the attribute; `contrast` is the default and carries none. */
export function applyFloatingBarStyle(
  style: FloatingBarStyle,
  root: HTMLElement = document.documentElement
) {
  if (style === "match") root.setAttribute(FLOATING_BAR_ATTRIBUTE, style);
  else root.removeAttribute(FLOATING_BAR_ATTRIBUTE);
}
