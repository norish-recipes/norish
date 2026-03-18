/**
 * Allowed image MIME types for uploads (recipes, avatars, etc.)
 */
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/**
 * Set for efficient MIME type lookup
 */
export const ALLOWED_IMAGE_MIME_SET = new Set<string>(ALLOWED_IMAGE_MIME_TYPES);

/**
 * Map of MIME type to file extension (for avatar uploads that need extension)
 */
export const IMAGE_MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

/**
 * Error that occurred during archive import (Mela/Mealie/Tandoor) for a specific file
 */
export type ArchiveImportError = {
  file: string;
  error: string;
};

/**
 * Skipped recipe during archive import (e.g., duplicates)
 */
export type ArchiveSkippedItem = {
  file: string;
  reason: string;
};

/**
 * Progress update for archive import
 * Recipe data is sent separately via recipeBatchCreated event
 */
export type ArchiveProgressPayload = {
  current: number;
  total: number;
  imported: number;
  errors: ArchiveImportError[];
};

/**
 * Completion event for archive import (user-scoped)
 */
export type ArchiveCompletedPayload = {
  imported: number;
  skipped: number;
  skippedItems: ArchiveSkippedItem[];
  errors: ArchiveImportError[];
};

/**
 * Allowed MIME types for OCR/image recipe import
 */
export const ALLOWED_OCR_MIME_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

export type AllowedOcrMimeType = (typeof ALLOWED_OCR_MIME_TYPES)[number];

export const ALLOWED_OCR_MIME_SET = new Set<string>(ALLOWED_OCR_MIME_TYPES);

export const MAX_OCR_FILES = 10;
export const MAX_RECIPE_PASTE_CHARS = 10_000;

/**
 * Allowed video MIME types for uploads
 */
export const ALLOWED_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
] as const;

export type AllowedVideoMimeType = (typeof ALLOWED_VIDEO_MIME_TYPES)[number];

/**
 * Set for efficient video MIME type lookup
 */
export const ALLOWED_VIDEO_MIME_SET = new Set<string>(ALLOWED_VIDEO_MIME_TYPES);

/**
 * Map of video MIME type to file extension
 */
export const VIDEO_MIME_TO_EXTENSION: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-m4v": "m4v",
};
