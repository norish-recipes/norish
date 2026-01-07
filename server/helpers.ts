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

  try {
    const hostname = new URL(str).hostname.toLowerCase();

    return (
      hostname.includes("youtube.com") ||
      hostname.includes("youtu.be") ||
      hostname.includes("instagram.com") ||
      hostname.includes("tiktok.com") ||
      hostname.includes("facebook.com") ||
      hostname.includes("fb.watch")
    );
  } catch {
    return false;
  }
}
