import type { ReactElement } from "react";
import React from "react";
// The one import of the experimental entry: a release that drops the marker breaks only this file.
import { ScrollViewMarker } from "react-native-screens/experimental";

/** Hands a tab's list to the tab bar, which minimises as it scrolls; a View between them hides it.
 * No bottom edge effect, as the list's fade meets the bar; the top one blurs rows under the heading. */
export function TabListMarker({ children }: { children: ReactElement }) {
  return (
    <ScrollViewMarker scrollEdgeEffects={{ bottom: "hidden", top: "soft" }} style={{ flex: 1 }}>
      {children}
    </ScrollViewMarker>
  );
}
