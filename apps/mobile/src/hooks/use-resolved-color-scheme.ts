import type { ResolvedColorScheme } from "@/lib/preferences/color-scheme";
import { useColorScheme } from "react-native";
import { useAppearancePreference } from "@/lib/preferences/appearance-preference-context";

export type { ResolvedColorScheme } from "@/lib/preferences/color-scheme";

/** The scheme the app is drawn in: the chosen one, or the system's under "system". Read it to pick
 * a hex by theme where no token fits, as a Store's colour does. */
export function useResolvedColorScheme(): ResolvedColorScheme {
  const { mode } = useAppearancePreference();
  const systemColorScheme = useColorScheme();

  // React Native can answer "unspecified"; anything but a dark answer is drawn light.
  return mode === "system" ? (systemColorScheme === "dark" ? "dark" : "light") : mode;
}
