/**
 * Image handling for JSON-LD recipe normalization.
 *
 * Handles downloading and normalizing images from JSON-LD image fields.
 */

import { downloadAllImagesFromJsonLd } from "@norish/api/downloader";
import { MAX_RECIPE_IMAGES } from "@norish/shared/contracts/zod";

export interface ParsedImage {
  image: string;
  order: number;
}

export interface ImageParseResult {
  images: ParsedImage[];
  primaryImage: string | undefined;
}

/**
 * Check if an image path is a local web path (already downloaded).
 */
function isLocalPath(img: unknown): img is string {
  return typeof img === "string" && img.startsWith("/recipes/");
}

/**
 * Parse and download images from JSON-LD image field.
 *
 * This function handles:
 * - Single local paths (already downloaded)
 * - Arrays with mixed local/remote paths
 * - Remote URLs that need downloading
 * - JSON-LD ImageObject structures
 *
 * @param imageField - The image field from JSON-LD (can be string, array, or ImageObject)
 * @param recipeId - Recipe ID for storage paths
 * @returns Parsed images with order and primary image
 */
export async function parseImages(
  imageField: unknown,
  recipeId: string
): Promise<ImageParseResult> {
  const defaultResult: ImageParseResult = {
    images: [],
    primaryImage: undefined,
  };

  if (!imageField) return defaultResult;

  let downloadedImages: string[] = [];

  // Single pre-downloaded image
  if (isLocalPath(imageField)) {
    downloadedImages = [imageField];
  } else if (Array.isArray(imageField)) {
    // Check if all are local paths
    const localPaths = imageField.filter(isLocalPath);
    const remotePaths = imageField.filter((img) => !isLocalPath(img));

    // Use local paths directly, download remote ones
    downloadedImages = [...localPaths];

    if (remotePaths.length > 0) {
      const downloaded = await downloadAllImagesFromJsonLd(
        remotePaths,
        recipeId,
        MAX_RECIPE_IMAGES - localPaths.length
      );

      downloadedImages.push(...downloaded);
    }
  } else {
    // Remote URLs - download them
    downloadedImages = await downloadAllImagesFromJsonLd(imageField, recipeId, MAX_RECIPE_IMAGES);
  }

  // Build images array with order
  const images: ParsedImage[] = downloadedImages.map((img, index) => ({
    image: img,
    order: index,
  }));

  // First image becomes the legacy `image` field for backwards compatibility
  const primaryImage = downloadedImages.length > 0 ? downloadedImages[0] : undefined;

  return { images, primaryImage };
}
