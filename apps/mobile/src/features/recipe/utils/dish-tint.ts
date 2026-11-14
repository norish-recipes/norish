import { oklchHueChromaFromSrgb, srgbFromOklab } from "@norish/shared/lib/oklab";

export type DishTint = { page: string; card: string; soft: string };

/** The most chroma a dish puts into the page ground, as web's tint (ADR-0023). */
const MAX_DISH_CHROMA = 0.05;

/** The theme's own lightness for the ground, the card and the chips on it, in light and dark. */
const LIGHTNESS = {
  light: { page: 0.964, card: 0.99, soft: 0.912 },
  dark: { page: 0.18, card: 0.235, soft: 0.264 },
} as const;

function hex({ r, g, b }: { r: number; g: number; b: number }): string {
  const channel = (value: number) =>
    Math.round(Math.min(1, Math.max(0, value)) * 255)
      .toString(16)
      .padStart(2, "0");

  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function oklch(lightness: number, chroma: number, hue: number): string {
  const radians = (hue * Math.PI) / 180;

  return hex(srgbFromOklab(lightness, chroma * Math.cos(radians), chroma * Math.sin(radians)));
}

/** The page, card and chip colours a Dish Colour tints the theme with, or null with nothing to tint by. */
export function dishTint(
  dishColor: string | null | undefined,
  scheme: "light" | "dark"
): DishTint | null {
  const match = dishColor?.match(/^#([0-9a-f]{6})$/i);

  if (!match) return null;

  const value = parseInt(match[1]!, 16);
  const { h, c } = oklchHueChromaFromSrgb((value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff);
  const chroma = Math.min(c, MAX_DISH_CHROMA);
  const lightness = LIGHTNESS[scheme];

  return {
    page: oklch(lightness.page, chroma, h),
    card: oklch(lightness.card, chroma * 0.3, h),
    soft: oklch(lightness.soft, chroma * 0.7, h),
  };
}
