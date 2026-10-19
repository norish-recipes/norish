/**
 * The most Source Images a recipe may hold. A Generated Image is not a
 * person's upload and does not count against this cap (ADR-0040).
 */
export const MAX_RECIPE_IMAGES = 10;

/**
 * The image a recipe leads with — one definition, everywhere.
 *
 * The gallery (`recipe_images`) is the source of truth: the first image by
 * order is the primary, and the legacy `recipes.image` scalar is only a
 * fallback for rows that predate the gallery. Every reader that shows a
 * recipe's picture resolves through this (the media carousel, the dashboard
 * projections, the realtime echo patch, the Dish Colour), and writers never
 * store a value in the scalar any more — the repository translates a payload
 * scalar into the gallery and clears the column on media-touching writes.
 * Only untouched legacy rows still carry one, which is why the fallback
 * stays until a migration retires the column.
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
  /** @deprecated The legacy scalar — read only as a fallback through this helper. */
  image?: string | null;
  images?: readonly GalleryImageLike[] | null;
};

function galleryOrder(galleryImage: GalleryImageLike): number {
  const order = Number(galleryImage.order ?? 0);

  return Number.isFinite(order) ? order : 0;
}

/** The first gallery image by order, falling back to the legacy scalar. */
export function primaryRecipeImage(carrier: PrimaryImageCarrier): string | null {
  const gallery = [...(carrier.images ?? [])].sort((a, b) => galleryOrder(a) - galleryOrder(b));

  return gallery[0]?.image ?? carrier.image ?? null;
}

/**
 * The "set as thumbnail" reorder: the chosen image leads the gallery.
 *
 * The gallery has one ordering and no second flag, so choosing a thumbnail is
 * choosing which image comes first. Every item is renumbered to its array
 * position, which keeps the primary rule (lowest order wins) and the carousel
 * agreeing. An index already at the front, or one outside the array, is a
 * no-op that returns a copy.
 */
export function promoteImageToThumbnail<T extends { order: number }>(
  media: readonly T[],
  index: number
): T[] {
  if (index <= 0 || index >= media.length) return [...media];

  const next = [...media];
  const [chosen] = next.splice(index, 1);

  if (chosen === undefined) return [...media];

  next.unshift(chosen);

  return next.map((item, position) => ({ ...item, order: position }));
}
