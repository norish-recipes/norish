export const MAX_RECIPE_IMAGES = 10;

/**
 * The gallery is the source of truth: the first image by order is the primary,
 * and the legacy `recipes.image` scalar is only a fallback for rows that
 * predate the gallery. A write that carries `images` moves a distinct scalar
 * into the gallery, or keeps it in the column when the gallery is full. A
 * scalar-only write fills an empty gallery and clears the column otherwise.
 */
type GalleryImageLike = { image: string; order?: unknown };

export type PrimaryImageCarrier = {
  image?: string | null;
  images?: readonly GalleryImageLike[] | null;
};

export function galleryOrder(galleryImage: { order?: unknown }): number {
  const order = Number(galleryImage.order ?? 0);

  return Number.isFinite(order) ? order : 0;
}

export function primaryRecipeImage(carrier: PrimaryImageCarrier): string | null {
  const gallery = [...(carrier.images ?? [])].sort((a, b) => galleryOrder(a) - galleryOrder(b));

  return gallery[0]?.image ?? carrier.image ?? null;
}

export function countSourceImages(images: readonly { generated?: boolean }[]): number {
  return images.filter((image) => image.generated !== true).length;
}

export function planScalarRetention(
  images: readonly { image: string; generated?: boolean }[],
  legacyScalar: string | null | undefined,
  maxSourceImages: number
): { append: boolean; kept: string | null } {
  const scalar = (legacyScalar ?? "").trim();

  if (scalar === "" || images.some((image) => image.image === scalar)) {
    return { append: false, kept: null };
  }

  if (countSourceImages(images) < maxSourceImages) return { append: true, kept: null };

  return { append: false, kept: scalar };
}

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
