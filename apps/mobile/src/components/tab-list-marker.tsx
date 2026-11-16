import type { ReactElement } from "react";
import React from "react";
// The one import of the experimental entry: a release that drops the marker breaks only this file.
import { ScrollViewMarker } from "react-native-screens/experimental";

/** Hands a tab's list to the tab bar, which minimises as it scrolls; a View between them hides it.
 * The list's own fade meets the tab bar, so iOS's bottom edge effect is off. */
export function TabListMarker({ children }: { children: ReactElement }) {
  return (
    <ScrollViewMarker scrollEdgeEffects={{ bottom: "hidden" }} style={{ flex: 1 }}>
      {children}
    </ScrollViewMarker>
  );
}
