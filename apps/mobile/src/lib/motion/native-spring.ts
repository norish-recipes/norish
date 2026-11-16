import { Animation } from "@expo/ui/swift-ui/modifiers";

import { SPRING } from "./spring";

/** The app's spring for SwiftUI views, and the short fade Reduce Motion gets instead. */
export const NATIVE_SPRING = Animation.interpolatingSpring(SPRING);
export const NATIVE_FADE = Animation.easeInOut({ duration: 0.15 });
