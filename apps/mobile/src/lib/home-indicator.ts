import { initialWindowMetrics } from "react-native-safe-area-context";

/** The window's bottom safe area: the home indicator the tab bar sits over. */
export const homeIndicator = initialWindowMetrics?.insets.bottom ?? 0;
