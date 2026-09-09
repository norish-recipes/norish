import type { ResolvedColorScheme } from "@/lib/color-scheme";
import { useColorScheme } from "react-native";
import { useAppearancePreference } from "@/context/appearance-preference-context";

export type { ResolvedColorScheme } from "@/lib/color-scheme";

/**
 * The scheme the app is drawn in right now: the one the user chose, or the
 * system's while the preference is "system". Anything that picks a hex by
 * theme rather than a theme token — a Store's colour — reads this.
 */
export function useResolvedColorScheme(): ResolvedColorScheme {
  const { mode } = useAppearancePreference();
  const systemColorScheme = useColorScheme();

  // React Native can answer "unspecified"; anything but a dark answer is drawn light.
  return mode === "system" ? (systemColorScheme === "dark" ? "dark" : "light") : mode;
}
