import { cubicBezier, Easing } from "react-native-reanimated";

/** The app's ease-out: quick to start, settling into its end. */
export const EASE_OUT = Easing.out(Easing.cubic);
/** `EASE_OUT` as a CSS transition's timing function. */
export const EASE_OUT_CSS = cubicBezier(0.33, 1, 0.68, 1);
