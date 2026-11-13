import { useCSSVariable } from "uniwind";

/** The dark ink on a warning-tinted button: brown in light, the warning itself in dark. */
export function useWarningInkColor(): string | undefined {
  const color = useCSSVariable("--color-warning-ink");

  return typeof color === "string" ? color : undefined;
}
