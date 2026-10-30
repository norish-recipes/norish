/*
 * Regenerates `public/screenshots/optimized` from the sources in
 * `assets/screenshots`. Run it after replacing any of them:
 *
 *   pnpm --filter @norish/landing shots
 *
 * The size table mirrors `components/shot.tsx`: every base is emitted at the
 * widths the page actually requests, as webp. Output sizes are exact; a source
 * whose aspect does not match is centre-cropped and called out, because it
 * usually means the capture came from a different window size than the rest
 * of the set (see assets/screenshots/README.md).
 */
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// sharp is not a dependency of the landing page itself; it resolves from the
// monorepo root, where Next.js already brings it along.
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const sourceDir = join(here, "..", "assets", "screenshots");
const outDir = join(here, "..", "public", "screenshots", "optimized");

const MOBILE = [
  [390, 773],
  [780, 1546],
];
const PHOTO = [
  [400, 533],
  [800, 1067],
];

/** Mirrors SHOTS in components/shot.tsx. */
const SHOTS = {
  "recipe-mobile": MOBILE,
  "cooking-mobile": MOBILE,
  "calendar-mobile": MOBILE,
  "groceries-mobile": MOBILE,
  "pantry-mobile": MOBILE,
  "recipe-web": [
    [800, 591],
    [1600, 1182],
  ],
  "nora-bench": PHOTO,
  "nora-snow": PHOTO,
  "nora-sunset": PHOTO,
};

const QUALITY = 82;

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

let written = 0;
const warnings = [];

for (const [base, sizes] of Object.entries(SHOTS)) {
  const source = join(sourceDir, `${base}.jpg`);

  let image;
  try {
    image = sharp(source);
    const master = await image.metadata();
    const [targetW, targetH] = sizes[sizes.length - 1];
    const drift = Math.abs(master.width / master.height / (targetW / targetH) - 1);

    if (drift > 0.005) {
      warnings.push(
        `${base}.jpg is ${master.width}x${master.height}; expected the ${targetW}:${targetH} ` +
          `aspect. Cropped to fit, but the capture likely used the wrong window size.`
      );
    }
  } catch {
    warnings.push(`missing source: ${base}.jpg`);
    continue;
  }

  for (const [width, height] of sizes) {
    await image
      .clone()
      .resize(width, height, { fit: "cover", position: "centre" })
      .webp({ quality: QUALITY })
      .toFile(join(outDir, `${base}-${width}.webp`));
    written += 1;
  }
}

console.log(`wrote ${written} files to public/screenshots/optimized`);

for (const warning of warnings) {
  console.warn(`WARN ${warning}`);
}

if (warnings.length > 0) process.exitCode = 1;
