/**
 * What writing a Generated Image does to a recipe's gallery, as one pure
 * decision.
 *
 * A Source Image — any row a person supplied or an import carried, recorded
 * with `generated = false` — is never destroyed by Image Generation. The
 * Generated Image takes the primary slot at order 0, and every Source Image
 * keeps its place in the gallery, after it, with its relative order intact.
 * Generated Images are replaceable: the previous one, wherever it sits, is
 * removed so a recipe holds at most one.
 *
 * The deprecated `recipes.image` scalar is a Source Image too. A recipe that
 * predates the gallery and stores its only photograph there gets that
 * photograph recovered as a gallery row rather than released, because the
 * column is a fallback and not an origin.
 *
 * The repository applies this plan inside its transaction;
 * `storeGeneratedRecipeImage` deletes only the files the plan releases.
 */

import { MAX_RECIPE_IMAGES } from "./recipe-media";

export interface GalleryImageRecord {
  id: string;
  image: string;
  order?: unknown;
  generated?: boolean;
  createdAt?: Date | string | null;
}

export interface GalleryImagePlacement {
  /** Row ids the write removes: every prior Generated Image. */
  deleteImageIds: string[];
  /** Surviving rows whose stored order changes, with its new integer order. */
  reorder: { id: string; order: number }[];
  /** A Source Image recovered from the deprecated scalar, after the surviving rows. */
  sourceFromScalar: { image: string; order: number } | null;
  /**
   * True when the scalar names a Source Image that the gallery cannot hold
   * because the Source Image cap is full. The write must then keep the column.
   */
  keepScalar: boolean;
  /** URLs no surviving row or kept scalar references, so their files may be removed. */
  replacedImageUrls: string[];
}

function galleryOrder(image: GalleryImageRecord): number {
  const order = Number(image.order ?? 0);

  return Number.isFinite(order) ? order : 0;
}

function createdTime(image: GalleryImageRecord): number {
  if (!image.createdAt) return 0;

  const time = new Date(image.createdAt).getTime();

  return Number.isFinite(time) ? time : 0;
}

function compareGalleryOrder(a: GalleryImageRecord, b: GalleryImageRecord): number {
  const byOrder = galleryOrder(a) - galleryOrder(b);

  if (byOrder !== 0) return byOrder;

  const byTime = createdTime(a) - createdTime(b);

  return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
}

export function planGeneratedImageReplacement(
  rows: readonly GalleryImageRecord[],
  imageUrl: string,
  legacyScalar?: string | null
): GalleryImagePlacement {
  const sorted = [...rows].sort(compareGalleryOrder);
  const generated = sorted.filter((row) => row.generated === true);
  const sources = sorted.filter((row) => row.generated !== true);
  const scalar = (legacyScalar ?? "").trim();
  const generatedUrls = new Set(generated.map((row) => row.image));
  const scalarIsUnrepresented =
    scalar !== "" &&
    scalar !== imageUrl &&
    !generatedUrls.has(scalar) &&
    !sources.some((row) => row.image === scalar);

  const reorder = sources.flatMap((row, index) => {
    const order = index + 1;

    return galleryOrder(row) === order ? [] : [{ id: row.id, order }];
  });

  const sourceFromScalar =
    scalarIsUnrepresented && sources.length < MAX_RECIPE_IMAGES
      ? { image: scalar, order: sources.length + 1 }
      : null;
  const keepScalar = scalarIsUnrepresented && sourceFromScalar === null;

  const retainedUrls = new Set(sources.map((row) => row.image));

  if (scalarIsUnrepresented) retainedUrls.add(scalar);

  const candidates = new Set(generatedUrls);

  if (scalar !== "" && !scalarIsUnrepresented) candidates.add(scalar);

  return {
    deleteImageIds: generated.map((row) => row.id),
    reorder,
    sourceFromScalar,
    keepScalar,
    replacedImageUrls: [...candidates].filter(
      (candidate) => candidate !== imageUrl && !retainedUrls.has(candidate)
    ),
  };
}
