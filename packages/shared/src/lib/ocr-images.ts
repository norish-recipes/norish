import { ALLOWED_OCR_MIME_SET, MAX_OCR_FILES } from "../contracts/uploads";

/** Why an image can't go into an image import: not JPEG, PNG or WebP, or over the size limit. */
export type OcrImageRefusal = "type" | "size";

/** The refusal for one picked image, or null when the import takes it. */
export function refuseOcrImage(
  image: { type: string; size: number },
  maxImageSize: number
): OcrImageRefusal | null {
  if (!ALLOWED_OCR_MIME_SET.has(image.type)) return "type";
  if (image.size > maxImageSize) return "size";

  return null;
}

/** Split added images into those that fit beside `held` under `MAX_OCR_FILES` and the rest. */
export function fitOcrCap<T>(held: number, added: T[]): { kept: T[]; dropped: T[] } {
  const slots = Math.max(0, MAX_OCR_FILES - held);

  return { kept: added.slice(0, slots), dropped: added.slice(slots) };
}
