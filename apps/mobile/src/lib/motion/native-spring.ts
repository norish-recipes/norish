import { Animation } from "@expo/ui/swift-ui/modifiers";

import { SPRING } from "./spring";

/** The app's spring for SwiftUI views. */
export const NATIVE_SPRING = Animation.interpolatingSpring(SPRING);
