import { FadeIn, ReduceMotion } from "react-native-reanimated";

// Reanimated snaps every animation under Reduce Motion, so the plain fade opts out of that.
export const FADE_IN = FadeIn.duration(240).reduceMotion(ReduceMotion.Never);
