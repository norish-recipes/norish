/**
 * OKLab / OKLCH conversions, per Björn Ottosson's reference implementation.
 * One copy of the matrices for the whole product: the server extracts the
 * Dish Colour with them (media/dish-color.ts) and the web client derives
 * the page tint's channels from the stored hex (features/recipes/lib/dish-tint.ts) — two
 * sides of ADR-0023 that must agree digit for digit.
 */

export function srgbChannelToLinear(channel: number): number {
  return channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

export function linearChannelToSrgb(channel: number): number {
  return channel <= 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 1 / 2.4) - 0.055;
}

/** sRGB (0–255 per channel) → OKLab. */
export function oklabFromSrgb(
  red: number,
  green: number,
  blue: number
): { L: number; a: number; b: number } {
  const r = srgbChannelToLinear(red / 255);
  const g = srgbChannelToLinear(green / 255);
  const b = srgbChannelToLinear(blue / 255);

  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

/** OKLab → sRGB channels in [0, 1]; out-of-gamut values fall outside it. */
export function srgbFromOklab(
  L: number,
  a: number,
  b: number
): { r: number; g: number; b: number } {
  const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
  const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
  const s = Math.pow(L - 0.0894841775 * a - 1.291485548 * b, 3);

  return {
    r: linearChannelToSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: linearChannelToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: linearChannelToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

/**
 * Hue (degrees, [0, 360)) and chroma of an sRGB colour in OKLCH. A genuinely
 * neutral colour has no meaningful hue angle and is pinned to 0, so the
 * answer is stable rather than whatever atan2 makes of rounding noise.
 */
export function oklchHueChromaFromSrgb(
  red: number,
  green: number,
  blue: number
): { h: number; c: number } {
  const { a, b } = oklabFromSrgb(red, green, blue);
  const c = Math.sqrt(a * a + b * b);

  if (c < 1e-6) return { h: 0, c: 0 };

  const h = (Math.atan2(b, a) * 180) / Math.PI;

  return { h: h < 0 ? h + 360 : h, c };
}
