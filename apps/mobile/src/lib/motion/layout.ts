import {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  ZoomIn,
  ZoomOut,
} from "react-native-reanimated";

import { sprung } from "./spring";

/** A view fading or scaling in and out, and moving to its new place, each on the app's spring. */
export const SPRING_FADE_IN = sprung(FadeIn.springify());
export const SPRING_FADE_OUT = sprung(FadeOut.springify());
export const SPRING_LAYOUT = sprung(LinearTransition.springify());
export const SPRING_ZOOM_IN = sprung(ZoomIn.springify());
export const SPRING_ZOOM_OUT = sprung(ZoomOut.springify());

/** The same entrance and exit as a plain fade, for a reader who has asked for Reduce Motion. */
export const FADE_REDUCED_IN = FadeIn.duration(200).reduceMotion(ReduceMotion.Never);
export const FADE_REDUCED_OUT = FadeOut.duration(200).reduceMotion(ReduceMotion.Never);
