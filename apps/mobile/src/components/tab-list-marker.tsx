import type { ReactElement } from "react";
import React from "react";
// The one import of the experimental entry: a release that drops the marker breaks only this file.
import { ScrollViewMarker } from "react-native-screens/experimental";

/** Hands a tab's list to the tab bar, which minimises as it scrolls; a View between them hides it.
 * The list's own fade meets the bar, so the bottom edge effect is off; the top blurs softly. */
export function TabListMarker({ children }: { children: ReactElement }) {
  return (
    <ScrollViewMarker scrollEdgeEffects={{ bottom: "hidden", top: "soft" }} style={{ flex: 1 }}>
      {children}
    </ScrollViewMarker>
  );
}
