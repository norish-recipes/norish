import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";

import { storeHue } from "@norish/shared/lib/store-colors";

/** A Store's colour in `scheme`; undefined for Unsorted and a recipe's lines, which have none. */
export function storeColorIn(
  scheme: "light" | "dark",
  color: string | null | undefined
): string | undefined {
  return color ? storeHue(color)[scheme] : undefined;
}

/** A Store's colour in the theme in force. */
export function useStoreColor(color: string | null | undefined): string | undefined {
  return storeColorIn(useResolvedColorScheme(), color);
}
