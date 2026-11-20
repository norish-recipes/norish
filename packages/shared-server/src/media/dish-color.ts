import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { serverLogger as log } from "@norish/shared-server/logger";
import { oklabFromSrgb, srgbFromOklab } from "@norish/shared/lib/oklab";
import { primaryRecipeImage } from "@norish/shared/lib/recipe-media";

/**
 * The Dish Colour (ADR-0023): one colour taken from a recipe's primary image
 * when that image is stored, kept on the recipe so a page can be tinted
 * before the photo has arrived. Extraction is derivation, not supply — the
 * colour never travels in a Recipe Archive, and a recipe with no image has
 * none and renders on the plain theme background.
 *
 * Everything here is deliberately non-fatal: a recipe write that carries an
 * image must never fail because the colour could not be read from it, so
 * every path out of this module is a hex string or null, never a throw.
 */

const RECIPES_BASE_DIR = path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes");

/** The stored primary-image URL shape, as written by media/storage.ts. */
const RECIPE_IMAGE_URL_PATTERN = /^\/recipes\/([a-f0-9-]{36})\/([a-zA-Z0-9_-]+\.[a-zA-Z0-9]+)$/i;

/** Enough pixels to speak for the photo, few enough to cost nothing. */
const SAMPLE_SIZE = 64;

function toHexChannel(value: number): string {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0");
}

function hexFromOklch(L: number, c: number, h: number): string {
  // Reduce chroma until the colour fits sRGB — the standard oklch gamut
  // mapping, so the stored hex keeps its hue rather than clipping to a
  // different one channel by channel.
  let chroma = c;

  for (let step = 0; step < 12; step++) {
    const { r, g, b } = srgbFromOklab(L, chroma * Math.cos(h), chroma * Math.sin(h));

    if (r >= 0 && r <= 1 && g >= 0 && g <= 1 && b >= 0 && b <= 1) {
      return `#${toHexChannel(r * 255)}${toHexChannel(g * 255)}${toHexChannel(b * 255)}`;
    }

    chroma *= 0.75;
  }

  const { r, g, b } = srgbFromOklab(L, 0, 0);

  return `#${toHexChannel(r * 255)}${toHexChannel(g * 255)}${toHexChannel(b * 255)}`;
}

/**
 * One colour for the dish, as `#rrggbb`. Deliberately not the histogram
 * dominant — on a food photo the dominant bin is usually the white plate or
 * the worktop, which yields a colour that tints nothing (the glossary's
 * _Avoid_ list already refuses "dominant colour" as a name). Instead every
 * sampled pixel votes for its OKLCH hue with the square of its chroma, so
 * the saturated food outvotes the neutral background regardless of area;
 * the stored lightness and chroma are the same vote's averages, so the hex
 * itself looks like the dish. A genuinely neutral photo has no meaningful
 * votes and falls back to its plain average — a grey that tints as grey.
 *
 * Returns null for anything sharp cannot read.
 */
export async function extractDishColor(bytes: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(bytes)
      .resize(SAMPLE_SIZE, SAMPLE_SIZE, { fit: "cover" })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let weightTotal = 0;
    let sumSin = 0;
    let sumCos = 0;
    let sumChroma = 0;
    let sumLightness = 0;
    let plainR = 0;
    let plainG = 0;
    let plainB = 0;

    const pixels = info.width * info.height;

    for (let index = 0; index < pixels; index++) {
      const offset = index * info.channels;
      const red = data[offset]!;
      const green = data[offset + 1]!;
      const blue = data[offset + 2]!;

      plainR += red;
      plainG += green;
      plainB += blue;

      const { L, a, b } = oklabFromSrgb(red, green, blue);
      const chroma = Math.hypot(a, b);
      const weight = chroma * chroma;

      if (weight === 0) continue;

      const hue = Math.atan2(b, a);

      sumSin += weight * Math.sin(hue);
      sumCos += weight * Math.cos(hue);
      sumChroma += weight * chroma;
      sumLightness += weight * L;
      weightTotal += weight;
    }

    // A photo with essentially no saturated pixel anywhere: greyscale, or
    // near enough. Its colour is its average, and it will tint as neutral.
    if (weightTotal < 1e-4) {
      return `#${toHexChannel(plainR / pixels)}${toHexChannel(plainG / pixels)}${toHexChannel(plainB / pixels)}`;
    }

    return hexFromOklch(
      sumLightness / weightTotal,
      sumChroma / weightTotal,
      Math.atan2(sumSin, sumCos)
    );
  } catch (err) {
    log.warn({ err }, "Dish Colour extraction failed; recipe keeps no colour");

    return null;
  }
}

/**
 * The Dish Colour for a stored recipe-image URL. Only locally stored images
 * qualify — a remote URL or a legacy shape yields null rather than a fetch,
 * because extraction happens at store time and a URL this cannot resolve is
 * an image Norish is not holding.
 */
export async function dishColorForImageUrl(
  imageUrl: string | null | undefined
): Promise<string | null> {
  if (!imageUrl) return null;

  const match = imageUrl.match(RECIPE_IMAGE_URL_PATTERN);

  if (!match) return null;

  const [, recipeId, filename] = match;

  try {
    const bytes = await fs.readFile(path.join(RECIPES_BASE_DIR, recipeId!, filename!));

    return await extractDishColor(bytes);
  } catch (err) {
    log.warn({ err, imageUrl }, "Dish Colour source image could not be read");

    return null;
  }
}

type PrimaryImageCarrier = Parameters<typeof primaryRecipeImage>[0];

/**
 * A create payload with its Dish Colour computed from the primary image it
 * carries, by `primaryRecipeImage`: the image the page leads with, so the
 * tint and the hero never come from two different photos. Always overwrites whatever the payload claimed: the colour is
 * derived from the image, never supplied with the recipe.
 */
export async function withDishColor<T extends PrimaryImageCarrier>(
  dto: T
): Promise<T & { dishColor: string | null }> {
  return { ...dto, dishColor: await dishColorForImageUrl(primaryRecipeImage(dto)) };
}

/**
 * An update payload with its Dish Colour recomputed — but only when the
 * update actually touches the media. An edit that does not name `images`
 * says nothing about the photo, so it must say nothing about the colour
 * either. Whatever colour the payload itself claimed is dropped
 * first, for the same reason `withDishColor` overwrites it: the colour is
 * derived from the image, never supplied with the recipe.
 */
export async function withDishColorForUpdate<T extends PrimaryImageCarrier>(
  data: T
): Promise<Omit<T, "dishColor"> & { dishColor?: string | null }> {
  const { dishColor: _supplied, ...rest } = data as T & { dishColor?: unknown };

  if (rest.images === undefined) return rest;

  return withDishColor(rest);
}

/**
 * Recompute and store a recipe's Dish Colour from what it holds right now.
 * The create and update payloads carry their colour with them; this covers
 * the two mutations that change a stored recipe's media directly — a
 * gallery upload and a gallery delete — where an abandoned edit would
 * otherwise leave the page tinted for a photo it no longer leads with.
 * Non-fatal like everything here: the mutation that changed the gallery
 * must never fail because the colour would not refresh.
 */
export async function refreshDishColorForRecipe(recipeId: string): Promise<void> {
  try {
    // Loaded lazily: everything else in this module is pure media work, and
    // the archive parsers import it in contexts that never touch the
    // database — a static repository import would drag the whole db module
    // graph (and its config) into their load path.
    const { getRecipeMediaForDishColor, updateRecipeDishColor } =
      await import("@norish/db/repositories/recipes");
    const media = await getRecipeMediaForDishColor(recipeId);

    if (!media) return;

    const primaryImage = primaryRecipeImage({ images: media.galleryImages });

    await updateRecipeDishColor(recipeId, await dishColorForImageUrl(primaryImage));
  } catch (err) {
    log.warn({ err, recipeId }, "Dish Colour refresh failed; the stored colour stands");
  }
}
