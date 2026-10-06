import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import convert from "heic-convert";
import sharp from "sharp";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { resolveExistingWorkspacePath } from "@norish/shared-server/lib/workspace-paths";

/**
 * Ingredient Icons as files: the picture a person uploads or AI draws, made
 * into a small square WebP that stands on nothing, so it sits cleanly on any
 * page tint, light or dark. Own icons live under the uploads directory and
 * the icons Norish ships live with the set; both are named for their
 * content, so one address always means one picture and a replaced icon is a
 * new address (ADR-0021).
 */

/**
 * An icon's side in pixels: the largest it is shown at, twice a line's, so
 * a line stays sharp on a high-density screen and the panel goes a little
 * soft. Small on purpose: the shipped set is about 5,600 files in the repo.
 */
export const ICON_SIZE = 64;
/** The food fits inside this, centred, so no icon touches its edge. */
const FOOD_SIZE = 58;
/** The size the cut-out reads a picture at: plenty for a 64px icon, cheap to flood. */
const WORK_SIZE = 512;
/**
 * How far a pixel's colour may stray from the background's and still be
 * background, as a distance in RGB. Loose enough for a camera's noise and a
 * drawn background's faint falloff, tight enough that a pale food's outline
 * stops the flood. The sample sheet is where this gets tuned.
 */
const TOLERANCE = 32;
/** How much of the border must be one colour for a picture to have a background to remove. */
const FLAT_BORDER = 0.9;
/** An alpha at or below this is see-through. */
const CLEAR = 16;

/** Where own icons are stored, and every address's path. */
export const ownIconsDir = () => path.join(SERVER_CONFIG.UPLOADS_DIR, "ingredient-icons");
export const ICON_ROUTE = "/ingredient-icons";

/** Where the shipped set lives: its `manifest.json`, and its files under `icons/`. */
export function iconSetDir(): string {
  return resolveExistingWorkspacePath(
    path.join("packages", "shared-server", "src", "ingredients", "icon-set")
  );
}

/** An icon file's name: its content's hash, so a file is never rewritten with other bytes. */
export const ICON_FILE_PATTERN = /^[a-f0-9]{32}\.webp$/;

export function iconAddress(file: string): string {
  return `${ICON_ROUTE}/${file}`;
}

function isHeic(bytes: Buffer): boolean {
  if (bytes.length < 12 || bytes.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = bytes.toString("ascii", 8, 12);

  return brand === "mif1" || brand === "msf1" || brand.startsWith("hei") || brand.startsWith("hev");
}

/** Whether any pixel of an RGBA buffer is see-through. */
function hasTransparency(pixels: Buffer): boolean {
  for (let at = 3; at < pixels.length; at += 4) {
    if (pixels[at]! <= CLEAR) return true;
  }

  return false;
}

/**
 * Make the flat background touching the picture's edges see-through, by a
 * flood from the border: a pixel goes when it is the background's colour and
 * joins the border through pixels that are too, so a patch of that colour
 * inside the food stays. A border that is not one colour has no background
 * to remove, and the picture is left alone. Says whether it cut.
 */
function cutOutBackground(pixels: Buffer, width: number, height: number): boolean {
  const border: number[] = [];

  for (let x = 0; x < width; x++) border.push(x, (height - 1) * width + x);
  for (let y = 1; y < height - 1; y++) border.push(y * width, y * width + width - 1);

  const median = (channel: number) => {
    const values = border.map((pixel) => pixels[pixel * 4 + channel]!).sort((a, b) => a - b);

    return values[values.length >> 1]!;
  };
  const background = [median(0), median(1), median(2)] as const;
  const isBackground = (pixel: number) => {
    const at = pixel * 4;
    const dr = pixels[at]! - background[0];
    const dg = pixels[at + 1]! - background[1];
    const db = pixels[at + 2]! - background[2];

    return dr * dr + dg * dg + db * db <= TOLERANCE * TOLERANCE;
  };

  if (border.filter(isBackground).length < border.length * FLAT_BORDER) return false;

  const seen = new Uint8Array(width * height);
  const stack: number[] = [];
  const visit = (pixel: number) => {
    if (seen[pixel] || !isBackground(pixel)) return;
    seen[pixel] = 1;
    stack.push(pixel);
  };

  border.forEach(visit);
  while (stack.length > 0) {
    const pixel = stack.pop()!;
    const x = pixel % width;

    pixels[pixel * 4 + 3] = 0;
    if (x > 0) visit(pixel - 1);
    if (x < width - 1) visit(pixel + 1);
    if (pixel >= width) visit(pixel - width);
    if (pixel < width * (height - 1)) visit(pixel + width);
  }

  return true;
}

/** The smallest box around every pixel that is not see-through, or null when there is none. */
function foodBounds(pixels: Buffer, width: number, height: number) {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (pixels[(y * width + x) * 4 + 3]! <= CLEAR) continue;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }

  return right < 0 ? null : { left, top, width: right - left + 1, height: bottom - top + 1 };
}

/**
 * Turn picture bytes (JPEG, PNG, WebP, AVIF or HEIC, within the image size
 * limit) into an Ingredient Icon: a 64px square WebP that stands on
 * nothing. A picture that already has transparency is only trimmed to its
 * food and fitted; otherwise the flat background touching its edges is cut
 * away first; a picture with no flat background is fitted as it is.
 */
export async function makeIngredientIcon(input: Buffer): Promise<Buffer> {
  if (input.length > SERVER_CONFIG.MAX_IMAGE_FILE_SIZE) {
    throw new Error(
      `Image too large: ${input.length} bytes (max: ${SERVER_CONFIG.MAX_IMAGE_FILE_SIZE})`
    );
  }

  const bytes = isHeic(input)
    ? Buffer.from(
        new Uint8Array(
          // heic-convert takes a Uint8Array whatever its types say.
          (await convert({
            buffer: new Uint8Array(input) as unknown as ArrayBuffer,
            format: "PNG",
          })) as ArrayBuffer
        )
      )
    : input;
  const { data: pixels, info } = await sharp(bytes)
    .rotate()
    .resize(WORK_SIZE, WORK_SIZE, { fit: "inside", withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const standsOnNothing = hasTransparency(pixels) || cutOutBackground(pixels, width, height);
  const bounds = standsOnNothing ? foodBounds(pixels, width, height) : null;

  if (standsOnNothing && !bounds) throw new Error("The picture holds nothing but its background");

  const margin = (ICON_SIZE - FOOD_SIZE) / 2;
  const clear = { r: 0, g: 0, b: 0, alpha: 0 };
  const food = sharp(pixels, { raw: { width, height, channels: 4 } });

  return await (bounds ? food.extract(bounds) : food)
    .resize(FOOD_SIZE, FOOD_SIZE, { fit: "contain", background: clear })
    .extend({ top: margin, bottom: margin, left: margin, right: margin, background: clear })
    .webp({ quality: 70, alphaQuality: 80 })
    .toBuffer();
}

/** How far in from where a side starts a tile's edge is solid; a round food takes four or more. */
const TILE_EDGE = 2;

/**
 * Whether an icon stands on a tile: an opaque rounded square drawn behind
 * the food, as a model asked for "an app icon" sometimes does. A tile fills
 * the icon's whole square both ways, and on all four sides it turns solid
 * across its middle half within a couple of pixels of where it starts. A
 * round food curves first, and a can or a glass is taller than it is wide.
 */
export async function standsOnTile(icon: Buffer): Promise<boolean> {
  const { data, info } = await sharp(icon)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const size = info.width;
  const alpha = (x: number, y: number) => data[(y * size + x) * 4 + 3]!;
  // Each side as lines going inwards: line `d` in from the side, pixel `i` along it.
  const sides = [
    (d: number, i: number) => alpha(i, d),
    (d: number, i: number) => alpha(i, size - 1 - d),
    (d: number, i: number) => alpha(d, i),
    (d: number, i: number) => alpha(size - 1 - d, i),
  ];
  const solidity = (side: (d: number, i: number) => number, d: number) => {
    let solid = 0;

    for (let i = size / 4; i < (size * 3) / 4; i++) if (side(d, i) > 128) solid++;

    return solid / (size / 2);
  };
  const starts = sides.map((side) => {
    for (let d = 0; d < size / 2; d++) if (solidity(side, d) > 0) return d;

    return size;
  });
  const [top, bottom, left, right] = starts as [number, number, number, number];
  const fillsSquare = Math.min(size - top - bottom, size - left - right) >= FOOD_SIZE - 3;

  return (
    fillsSquare &&
    sides.every((side, at) =>
      Array.from({ length: TILE_EDGE + 1 }, (_, d) => starts[at]! + d).some(
        (d) => solidity(side, d) >= 0.95
      )
    )
  );
}

/** An icon file's name: the first half of its content's SHA-256. */
export function iconFileName(icon: Buffer): string {
  return `${createHash("sha256").update(icon).digest("hex").slice(0, 32)}.webp`;
}

/**
 * Make a picture into an icon and store it as an own icon, attached to no
 * Ingredient yet: a panel's draft holds it until Save, and the scheduled
 * sweep removes it if nothing ever does. Answers the file's name.
 */
export async function storeIngredientIcon(picture: Buffer): Promise<string> {
  const icon = await makeIngredientIcon(picture);
  const file = iconFileName(icon);

  await fs.mkdir(ownIconsDir(), { recursive: true });
  // Rewritten when it exists: the same bytes, and a fresh age for the sweep's grace.
  await fs.writeFile(path.join(ownIconsDir(), file), icon);

  return file;
}

/**
 * Claim a stored own icon for a food: whether it is there, and a fresh age
 * for it, so the sweep, which spares recent files, never takes a file in the
 * moment it is being attached.
 */
export async function claimOwnIcon(file: string): Promise<boolean> {
  if (!ICON_FILE_PATTERN.test(file)) return false;

  try {
    const now = new Date();

    await fs.utimes(path.join(ownIconsDir(), file), now, now);

    return true;
  } catch {
    return false;
  }
}
