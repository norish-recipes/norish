/**
 * The media itself could not be had: the download turned up nothing, or length
 * validation refused what was there.
 *
 * This is the only failure that means "there was no video here", and so the only
 * one an Unclassified Post may recover from by reading the caption instead. A
 * transcription or AI failure means the video was real and something downstream
 * broke; recovering from that would hand the user a thin caption-only recipe
 * with no signal that their provider is down, which is the silent degradation
 * #513 was made of.
 */
export class MediaUnavailableError extends Error {
  readonly name = "MediaUnavailableError";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
  }
}

/** Whether a thrown value says the media could not be had. */
export function isMediaUnavailable(error: unknown): error is MediaUnavailableError {
  return error instanceof MediaUnavailableError;
}
