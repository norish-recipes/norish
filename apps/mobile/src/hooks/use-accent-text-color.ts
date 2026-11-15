import { useTokenColor } from "@/hooks/use-token-color";

/** The accent for text and icons on the page ground: lifted in dark. useThemeColor doesn't name it. */
export function useAccentTextColor(): string | undefined {
  return useTokenColor("accent-text");
}
