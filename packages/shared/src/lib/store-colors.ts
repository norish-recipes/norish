import type { StoreColor } from "../contracts/dto/stores";

/** What a Store's colour looks like: named by its hue, one hex for each theme. */
export interface StoreHue {
  /** The hue's name, as a screen reader should say it; the locales carry the word. */
  name: "green" | "rose" | "teal" | "amber" | "red" | "grey" | "blue" | "violet";
  light: string;
  dark: string;
}

/**
 * The one table both web and mobile read a Store's colour from, keyed by the
 * eight colour keys a Store is stored with. Each key is a clearly distinct
 * hue, so no two Stores end up alike on either surface, and the same Store is
 * the same red beside "Dirk" on the phone and the web. Nothing here follows a
 * theme token: a Store's colour is its identity, and the brand green is a
 * fixed hex that matches the accent by eye and never moves with it.
 */
export const STORE_HUES: Record<StoreColor, StoreHue> = {
  primary: { name: "green", light: "#336640", dark: "#62ab74" },
  secondary: { name: "rose", light: "#db2777", dark: "#f472b6" },
  success: { name: "teal", light: "#0d9488", dark: "#2dd4bf" },
  warning: { name: "amber", light: "#d97706", dark: "#fbbf24" },
  danger: { name: "red", light: "#dc2626", dark: "#f87171" },
  slate: { name: "grey", light: "#64748b", dark: "#94a3b8" },
  sky: { name: "blue", light: "#0284c7", dark: "#38bdf8" },
  violet: { name: "violet", light: "#7c3aed", dark: "#a78bfa" },
};

/** The colour keys in the order the picker shows them. */
export const STORE_COLOR_KEYS: readonly StoreColor[] = [
  "primary",
  "secondary",
  "success",
  "warning",
  "danger",
  "slate",
  "sky",
  "violet",
];

function isStoreColor(color: string): color is StoreColor {
  return Object.hasOwn(STORE_HUES, color);
}

/**
 * A Store's colour key as stored, read back as one of the eight. A value the
 * table does not know — a Store written by a build with another palette —
 * reads as the brand green, the default a Store is created with, rather than
 * as no colour at all.
 */
export function storeColorKey(color: string): StoreColor {
  return isStoreColor(color) ? color : "primary";
}

/** The hue of a Store's colour as stored. */
export function storeHue(color: string): StoreHue {
  return STORE_HUES[storeColorKey(color)];
}
