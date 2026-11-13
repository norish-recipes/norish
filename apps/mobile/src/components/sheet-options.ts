import type { NativeStackNavigationOptions } from "expo-router/native-stack";

/** Shared by both: a form sheet on the native glass, with the screen drawing its own header. */
const FORM_SHEET = {
  presentation: "formSheet",
  headerShown: false,
} as const satisfies NativeStackNavigationOptions;

/**
 * A sheet whose content may not fit: opens at 62% with a grabber, and dragging or scrolling its
 * list to the edge takes it to full height. `bottom: 0` lets the content fill the sheet at every
 * detent, so the layout pins its header and actions with flexbox.
 */
export const SHEET_OPTIONS = {
  ...FORM_SHEET,
  sheetGrabberVisible: true,
  sheetAllowedDetents: [0.62, 1],
  sheetInitialDetentIndex: 0,
  sheetExpandsWhenScrolledToEdge: true,
  contentStyle: { backgroundColor: "transparent", bottom: 0 },
} as const satisfies NativeStackNavigationOptions;

/** A sheet as tall as its content, which does not resize. */
export const FIT_SHEET_OPTIONS = {
  ...FORM_SHEET,
  sheetGrabberVisible: false,
  sheetAllowedDetents: "fitToContents",
  contentStyle: { backgroundColor: "transparent" },
} as const satisfies NativeStackNavigationOptions;
