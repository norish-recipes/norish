import type { NativeStackNavigationOptions } from "expo-router/native-stack";

/** A screen whose native header a `ModalHeader` fills: the stack's own, over the content. */
export const EDITOR_OPTIONS = {
  headerShown: true,
  headerTransparent: false,
  headerShadowVisible: false,
} as const satisfies NativeStackNavigationOptions;

/** Shared by both: a form sheet on the native glass, its header declared by `Sheet`. */
const FORM_SHEET = {
  ...EDITOR_OPTIONS,
  presentation: "formSheet",
  // The glass shows through the header, as through the rest of the sheet.
  headerStyle: { backgroundColor: "transparent" },
} as const satisfies NativeStackNavigationOptions;

/** Opens at 62% and expands by drag or by scrolling to the edge; `bottom: 0` makes the content
 *  fill the sheet at every detent, so `Sheet` pins its actions with flexbox. */
export const SHEET_OPTIONS = {
  ...FORM_SHEET,
  sheetGrabberVisible: true,
  sheetAllowedDetents: [0.62, 1],
  sheetInitialDetentIndex: 0,
  sheetExpandsWhenScrolledToEdge: true,
  contentStyle: { backgroundColor: "transparent", bottom: 0 },
} as const satisfies NativeStackNavigationOptions;

/** A sheet with a search field and a list: one detent, because UIKit expands a sheet that has
 *  more to the full height, drawn opaque, when the keyboard rises; this one rises with it. */
export const SEARCH_SHEET_OPTIONS = {
  ...SHEET_OPTIONS,
  sheetGrabberVisible: false,
  sheetAllowedDetents: [0.5],
  sheetExpandsWhenScrolledToEdge: false,
} as const satisfies NativeStackNavigationOptions;

/** A sheet as tall as its content, which does not resize. */
export const FIT_SHEET_OPTIONS = {
  ...FORM_SHEET,
  sheetGrabberVisible: false,
  sheetAllowedDetents: "fitToContents",
  contentStyle: { backgroundColor: "transparent" },
} as const satisfies NativeStackNavigationOptions;
