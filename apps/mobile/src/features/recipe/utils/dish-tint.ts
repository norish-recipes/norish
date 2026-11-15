import { dishHueChroma, srgbFromOklab } from "@norish/shared/lib/oklab";

export type DishTint = { page: string; card: string; soft: string };

/** The share of the page's chroma the card and the chips on it take, as web's CSS does. */
const CARD_CHROMA_SHARE = 0.3;
const SOFT_CHROMA_SHARE = 0.7;

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
  const tint = dishHueChroma(dishColor);

  if (!tint) return null;

  const { h, c: chroma } = tint;
  const lightness = LIGHTNESS[scheme];

  return {
    page: oklch(lightness.page, chroma, h),
    card: oklch(lightness.card, chroma * CARD_CHROMA_SHARE, h),
    soft: oklch(lightness.soft, chroma * SOFT_CHROMA_SHARE, h),
  };
}
