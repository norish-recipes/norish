import { useCSSVariable } from "uniwind";

/** The accent for text and icons on the page ground: lifted in dark. useThemeColor doesn't name it. */
export function useAccentTextColor(): string | undefined {
  const color = useCSSVariable("--color-accent-text");

  return typeof color === "string" ? color : undefined;
}
