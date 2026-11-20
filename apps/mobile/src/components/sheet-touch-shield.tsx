import React from "react";
import { StyleSheet, View } from "react-native";
import { useSheetOpenWaiting } from "@/lib/after-sheet";

/** Over the stacks while a sheet's queued open waits: a second tap lands here, not on what
 * the leaving sheet uncovers. The sheet is a native modal above it, so its dismissal is untouched. */
export function SheetTouchShield() {
  if (!useSheetOpenWaiting()) return null;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
      testID="sheet-touch-shield"
    />
  );
}
