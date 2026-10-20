import { galleryOrder, MAX_RECIPE_IMAGES, planScalarRetention } from "./recipe-media";

export interface GalleryImageRecord {
  id: string;
  image: string;
  order?: unknown;
  generated?: boolean;
  createdAt?: Date | string | null;
}

export interface GalleryImagePlacement {
  deleteImageIds: string[];
  reorder: { id: string; order: number }[];
  sourceFromScalar: { image: string; order: number } | null;
  keepScalar: boolean;
  replacedImageUrls: string[];
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

  const reorder = sources.flatMap((row, index) => {
    const order = index + 1;

    return galleryOrder(row) === order ? [] : [{ id: row.id, order }];
  });

  const scalarIsNewImage = scalar === imageUrl;
  const scalarIsGenerated = scalar !== "" && generatedUrls.has(scalar);
  const retention =
    scalar === "" || scalarIsNewImage || scalarIsGenerated
      ? { append: false, kept: null }
      : planScalarRetention(sources, scalar, MAX_RECIPE_IMAGES);
  const sourceFromScalar = retention.append ? { image: scalar, order: sources.length + 1 } : null;
  const keepScalar = retention.kept !== null;

  const retainedUrls = new Set(sources.map((row) => row.image));

  if (sourceFromScalar || keepScalar) retainedUrls.add(scalar);

  const candidates = new Set(generatedUrls);

  if (!sourceFromScalar && !keepScalar && scalar !== "") candidates.add(scalar);

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
