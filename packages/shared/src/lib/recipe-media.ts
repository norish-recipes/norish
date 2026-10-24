/**
 * The image a recipe leads with — one definition, everywhere.
 *
 * The gallery (`recipe_images`) holds a recipe's pictures, and the first image
 * by order is the primary. Every reader that shows a recipe's picture resolves
 * through this (the media carousel, the dashboard projections, the realtime
 * echo patch, the Dish Colour).
 *
 * The repository's SQL projections mirror this rule as a correlated
 * subquery (`PRIMARY_IMAGE_SQL` in the recipes repository); a change here
 * must move with it.
 */

/**
 * `order` stays loose because the zod contracts coerce it: callers hand this
 * whatever a form, an import, or a DTO carried, and it meets the payloads
 * where they are rather than demanding a parse first.
 */
type GalleryImageLike = { image: string; order?: unknown };

export type PrimaryImageCarrier = {
  images?: readonly GalleryImageLike[] | null;
};

function galleryOrder(galleryImage: GalleryImageLike): number {
  const order = Number(galleryImage.order ?? 0);

  return Number.isFinite(order) ? order : 0;
}

/** The first gallery image by order. */
export function primaryRecipeImage(carrier: PrimaryImageCarrier): string | null {
  const gallery = [...(carrier.images ?? [])].sort((a, b) => galleryOrder(a) - galleryOrder(b));

  return gallery[0]?.image ?? null;
}
