import { FadeIn, FadeOut, LinearTransition, ZoomIn, ZoomOut } from "react-native-reanimated";

import { sprung } from "./spring";

/** A view fading or scaling in and out, and moving to its new place, each on the app's spring. */
export const SPRING_FADE_IN = sprung(FadeIn.springify());
export const SPRING_FADE_OUT = sprung(FadeOut.springify());
export const SPRING_LAYOUT = sprung(LinearTransition.springify());
export const SPRING_ZOOM_IN = sprung(ZoomIn.springify());
export const SPRING_ZOOM_OUT = sprung(ZoomOut.springify());
