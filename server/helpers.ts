import { isSupportedVideoUrl } from "@/server/video/detector";
import { httpUrlSchema } from "@/lib/schema";

/**
 * Check if a string is a valid HTTP(S) URL.
 */
export function isUrl(str: string): boolean {
  return httpUrlSchema.safeParse(str).success;
}

/**
 * Check if a URL points to a supported video platform (YouTube, Instagram, TikTok, etc.)
 */
export function isVideoUrl(str: string): boolean {
  if (!isUrl(str)) return false;

  return isSupportedVideoUrl(str);
}
