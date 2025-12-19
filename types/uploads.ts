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
 * Maximum file sizes for uploads
 */
export const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB
export const MAX_RECIPE_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Error that occurred during archive import (Mela/Mealie/Tandoor) for a specific file
 */
export type ArchiveImportError = {
  file: string;
  error: string;
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

export const MAX_OCR_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
export const MAX_OCR_FILES = 10;
export const MAX_RECIPE_PASTE_CHARS = 10_000;
