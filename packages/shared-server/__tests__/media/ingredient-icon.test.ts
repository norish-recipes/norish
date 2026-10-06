// @vitest-environment node
/**
 * Making an Ingredient Icon from a picture: a product shot on a plain
 * background comes out cut free, standing on nothing; a photo whose
 * background is not one flat colour is kept as it is; a picture that already
 * stands on nothing is only trimmed. Whatever goes in, a 128px square WebP
 * comes out. The pictures are drawn by sharp inside the test.
 */
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

const config = vi.hoisted(() => ({ MAX_IMAGE_FILE_SIZE: 10 * 1024 * 1024, UPLOADS_DIR: "/tmp" }));

vi.mock("@norish/config/env-config-server", () => ({ SERVER_CONFIG: config }));

const { makeIngredientIcon } = await import("@norish/shared-server/media/ingredient-icon");

const SIZE = 200;

/** A picture drawn from SVG shapes, as JPEG (a camera's noise) or PNG. */
function picture(shapes: string, format: "jpeg" | "png" = "png"): Promise<Buffer> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">${shapes}</svg>`;
  const image = sharp(Buffer.from(svg));

  return format === "jpeg" ? image.jpeg({ quality: 85 }).toBuffer() : image.png().toBuffer();
}

/** The icon's pixel at (x, y), as RGBA. */
async function pixelAt(icon: Buffer, x: number, y: number) {
  const { data, info } = await sharp(icon)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const at = (y * info.width + x) * 4;

  return { r: data[at]!, g: data[at + 1]!, b: data[at + 2]!, a: data[at + 3]! };
}

const WHITE = `<rect width="${SIZE}" height="${SIZE}" fill="#ffffff"/>`;

describe("makeIngredientIcon", () => {
  it("makes a 128px square WebP", async () => {
    const icon = await makeIngredientIcon(
      await picture(`${WHITE}<circle cx="100" cy="100" r="60" fill="#d02020"/>`)
    );
    const meta = await sharp(icon).metadata();

    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(128);
    expect(meta.height).toBe(128);
    expect(meta.hasAlpha).toBe(true);
  });

  it("cuts a food free of the flat background around it, a camera's noise and all", async () => {
    const icon = await makeIngredientIcon(
      await picture(`${WHITE}<circle cx="100" cy="100" r="60" fill="#d02020"/>`, "jpeg")
    );

    // The corner of the food's box is the background's, now see-through.
    expect((await pixelAt(icon, 12, 12)).a).toBe(0);
    const centre = await pixelAt(icon, 64, 64);

    expect(centre.a).toBe(255);
    expect(centre.r).toBeGreaterThan(150);
    expect(centre.g).toBeLessThan(80);
  });

  it("keeps a patch of the background's colour inside the food", async () => {
    // A ring of tomato around a white middle: the middle never touches the edge.
    const icon = await makeIngredientIcon(
      await picture(
        `${WHITE}<circle cx="100" cy="100" r="60" fill="#d02020"/><circle cx="100" cy="100" r="25" fill="#ffffff"/>`
      )
    );
    const middle = await pixelAt(icon, 64, 64);

    expect(middle.a).toBe(255);
    expect(middle.r).toBeGreaterThan(230);
    expect(middle.g).toBeGreaterThan(230);
  });

  it("keeps a picture whose border is not one flat colour as it is", async () => {
    const gradient = `<defs><linearGradient id="g"><stop offset="0" stop-color="#000000"/><stop offset="1" stop-color="#ffffff"/></linearGradient></defs><rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>`;
    const icon = await makeIngredientIcon(
      await picture(`${gradient}<circle cx="100" cy="100" r="40" fill="#d02020"/>`)
    );

    // Nothing cut: the corners keep the photo's own background.
    expect((await pixelAt(icon, 8, 8)).a).toBe(255);
    expect((await pixelAt(icon, 119, 119)).a).toBe(255);
  });

  it("only trims and fits a picture that already stands on nothing", async () => {
    // A small square in one corner of a see-through canvas.
    const icon = await makeIngredientIcon(
      await picture(`<rect x="10" y="10" width="40" height="40" fill="#20a040"/>`)
    );
    const centre = await pixelAt(icon, 64, 64);

    // Trimmed, the square fills the icon rather than sitting in its corner.
    expect(centre.a).toBe(255);
    expect(centre.g).toBeGreaterThan(120);
  });

  it("refuses a picture over the image size limit", async () => {
    const big = await picture(`${WHITE}<circle cx="100" cy="100" r="60" fill="#d02020"/>`);

    config.MAX_IMAGE_FILE_SIZE = big.length - 1;
    try {
      await expect(makeIngredientIcon(big)).rejects.toThrow(/too large/i);
    } finally {
      config.MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;
    }
  });
});
