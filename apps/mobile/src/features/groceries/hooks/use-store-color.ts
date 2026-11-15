import { useResolvedColorScheme } from "@/hooks/use-resolved-color-scheme";

import { storeHue } from "@norish/shared/lib/store-colors";

/** A Store's colour in the theme in force; undefined for Unsorted and a recipe's lines, which have none. */
export function useStoreColor(color: string | null | undefined): string | undefined {
  const scheme = useResolvedColorScheme();

  return color ? storeHue(color)[scheme] : undefined;
}
